const express = require('express');
const { marked } = require('marked');
const rw = require('../remnawaveClient');
const { getSettings } = require('../db');

const router = express.Router();

// Короткий UUID Remnawave — обычный uuid v4. На всякий случай не пускаем
// в API мусор из URL (например, запросы браузера на /favicon.ico).
const SHORT_UUID_RE = /^[a-zA-Z0-9-]{6,64}$/;

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
// Порядок проверок важен: у Android UA тоже встречается "Linux", поэтому
// его проверяем раньше.
function detectPlatform(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
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
// ссылки под конкретную платформу — чтобы шаблон ничего сам не решал.
function buildAppCards(apps, subscriptionUrl, platform) {
  return (apps || []).map((app) => {
    const installUrl =
      (app.install && (app.install[platform] || app.install.android || app.install.ios)) || '';
    const addUrl = subscriptionUrl ? (app.addScheme || '').replace('{url}', subscriptionUrl) : '';
    return {
      id: app.id,
      name: app.name,
      installUrl,
      addUrl,
    };
  });
}

router.get('/:shortUuid', async (req, res, next) => {
  const { shortUuid } = req.params;
  const settings = getSettings();

  if (!SHORT_UUID_RE.test(shortUuid)) {
    return res.status(404).render('errors/not-found', { settings });
  }

  try {
    const user = await rw.getUserByShortUuid(shortUuid);
    if (!user) {
      return res.status(404).render('errors/not-found', { settings });
    }

    const showRouterTab = isRouterUser(user, settings.routerKeyword);
    const subscriptionUrl = rw.buildSubscriptionUrl(shortUuid);
    const platform = detectPlatform(req.headers['user-agent']);

    // Роутерным пользователям ключи и инструкция нужны всегда — обычным
    // пользователям это не нужно, поэтому не дёргаем лишний запрос к панели.
    const rawKeys = showRouterTab ? await rw.getRawKeys(shortUuid) : [];
    const routerInstructionsHtml = showRouterTab
      ? marked.parse(settings.routerInstructionsMarkdown || '')
      : '';

    // Роутерным пользователям вкладку "Устройства" не показываем вообще —
    // только страницу настройки роутера (п.2.3 требований).
    const appCards = showRouterTab ? [] : buildAppCards(settings.apps, subscriptionUrl, platform);

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
