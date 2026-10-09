const express = require('express');
const { marked } = require('marked');
const rw = require('../remnawaveClient');
const cryptoLinks = require('../cryptoLinks');
const { applyHeaderOverrides, needsUser } = require('../headers');
const { getSettings } = require('../db');

const router = express.Router();

// Короткий UUID Remnawave — обычный uuid v4. На всякий случай не пускаем
// в API мусор из URL (например, запросы браузера на /favicon.ico).
const SHORT_UUID_RE = /^[a-zA-Z0-9-]{6,64}$/;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

function isRouterUser(user, keyword) {
  if (!keyword) return false;
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;

  const tag = (user.tag || '').toLowerCase();
  if (tag.includes(needle)) return true;

  const squads = user.activeInternalSquads || [];
  return squads.some((squad) => (squad.name || '').toLowerCase().includes(needle));
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 ГБ';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} ГБ`;
}

// Грубое, но достаточное для UX определение платформы по User-Agent.
function detectPlatform(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}

// Все современные браузеры (десктоп и мобильные) шлют "Mozilla/5.0..." —
// это и используем, чтобы отличить человека от VPN-приложения. У
// VPN-клиентов (Happ, INCY, v2rayNG, ClashMeta и т.п.) такого токена нет.
function isBrowserUA(userAgent) {
  return /mozilla/i.test(userAgent || '');
}

const PLATFORM_LABELS = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  unknown: 'ваше устройство',
};

// Собираем для каждого настроенного приложения (Happ, INCY, ...) готовые
// ссылки под конкретную платформу — по возможности зашифрованные.
async function buildAppCards(apps, subscriptionUrl, platform, brandName) {
  return Promise.all(
    (apps || []).map(async (app) => {
      const installUrl =
        (app.install && (app.install[platform] || app.install.android || app.install.ios)) || '';

      const plainAddUrl = subscriptionUrl
        ? (app.addScheme || '').replace('{url}', subscriptionUrl)
        : '';

      let addUrl = plainAddUrl;
      let encrypted = false;
      const provider =
        app.cryptoProvider !== undefined
          ? app.cryptoProvider
          : (['happ', 'incy'].includes(app.id) ? app.id : null);

      if (subscriptionUrl && provider === 'happ') {
        const crypt = await cryptoLinks.getHappCryptLink(subscriptionUrl);
        if (crypt) { addUrl = crypt; encrypted = true; }
      } else if (subscriptionUrl && provider === 'incy') {
        const crypt = cryptoLinks.getIncyCryptLink(subscriptionUrl, brandName);
        if (crypt) { addUrl = crypt; encrypted = true; }
      }

      return { id: app.id, name: app.name, installUrl, addUrl, encrypted };
    })
  );
}

router.get('/:shortUuid', async (req, res, next) => {
  const { shortUuid } = req.params;

  if (!SHORT_UUID_RE.test(shortUuid)) {
    return res.status(404).render('errors/not-found', { settings: getSettings() });
  }

  // Не-браузерные клиенты (VPN-приложения) получают "сырую" подписку
  // напрямую с панели — прозрачный проброс байт в байт, без рендеринга
  // HTML. Благодаря этому SUB_PUBLIC_DOMAIN можно указывать на ЭТОТ же
  // сервис — отдельный домен под саму панель не нужен.
  if (!isBrowserUA(req.headers['user-agent'])) {
    try {
      const upstream = await rw.proxyRawSubscription(shortUuid, {
        userAgent: req.headers['user-agent'],
        accept: req.headers['accept'],
      });
      const settings = getSettings();
      let headers = upstream.headers;
      if (upstream.status === 200) {
        let user = null;
        if (needsUser(settings)) {
          try {
            user = await rw.getUserByShortUuid(shortUuid);
          } catch (e) {
            console.error('[subscription] не удалось получить пользователя для заголовков:', e.message);
          }
        }
        headers = applyHeaderOverrides(headers, settings, {
          user,
          shortUuid,
          subscriptionUrl: rw.buildSubscriptionUrl(shortUuid, settings.subscriptionDomain),
        });
      }
      res.status(upstream.status);
      Object.entries(headers).forEach(([key, value]) => {
        if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
        try {
          res.setHeader(key, value);
        } catch (e) {
          console.error(`[subscription] заголовок ${key} пропущен: ${e.message}`);
        }
      });
      return res.send(upstream.body);
    } catch (err) {
      return next(err);
    }
  }

  const settings = getSettings();

  try {
    const user = await rw.getUserByShortUuid(shortUuid);
    if (!user) {
      return res.status(404).render('errors/not-found', { settings });
    }

    const showRouterTab = isRouterUser(user, settings.routerKeyword);
    const subscriptionUrl = rw.buildSubscriptionUrl(shortUuid, settings.subscriptionDomain);
    const platform = detectPlatform(req.headers['user-agent']);

    // Роутерным пользователям ключи и инструкция нужны всегда — обычным
    // пользователям это не нужно, поэтому не дёргаем лишний запрос к панели.
    const rawKeys = showRouterTab ? await rw.getConnectionKeys(user.id) : [];
    const routerInstructionsHtml = showRouterTab
      ? marked.parse(settings.routerInstructionsMarkdown || '')
      : '';

    // Роутерным пользователям вкладку "Устройства" не показываем вообще —
    // только страницу настройки роутера (п.2.3 требований).
    const appCards = showRouterTab
      ? []
      : await buildAppCards(settings.apps, subscriptionUrl, platform, settings.brandName);

    res.render('subscription', {
      settings,
      user,
      subscriptionUrl,
      rawKeys,
      showRouterTab,
      routerInstructionsHtml,
      platform,
      platformLabel: PLATFORM_LABELS[platform] || PLATFORM_LABELS.unknown,
      appCards,
      trafficUsed: formatBytes(user.usedTrafficBytes),
      trafficLimit: user.trafficLimitBytes ? formatBytes(user.trafficLimitBytes) : 'Безлимит',
      expireAt: user.expireAt ? new Date(user.expireAt) : null,
      isActive: user.status === 'ACTIVE',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
