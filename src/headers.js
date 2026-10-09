/**
 * Переписывает служебные заголовки подписки, которые читают VPN-клиенты
 * (Happ, INCY и др.). Поддерживает тот же синтаксис шаблонов, что и раздел
 * «Заголовки ответа» в панели Remnawave:
 *
 *   rwEncodeBase64:Текст {{DAYS_LEFT}} д.     — результат кодируется в base64:...
 *   {{STATUS:ACTIVE=Активна|EXPIRED=Истекла|DISABLED=Отключена|LIMITED=Лимит}}
 *
<<<<<<< HEAD
 * Переменные — те же, что в панели (DAYS_LEFT, TRAFFIC_LEFT, TOTAL_TRAFFIC, EXPIRE_UNIX,
 * NEXT_TRAFFIC_RESET_AT и т.д., см. buildVars) + BRAND, EXPIRE_DATE.
=======
 * Переменные: DAYS_LEFT, USERNAME, EMAIL, TELEGRAM_ID, TAG, STATUS,
 * TRAFFIC_USED, TRAFFIC_LIMIT, EXPIRE_DATE, SUBSCRIPTION_URL, SHORT_UUID, BRAND.
>>>>>>> ebaca8d9d453828eb4f5f28d405e7496f786907e
 * Устаревшие {username} и {brand} тоже работают.
 * Пустое поле в настройках = заголовок остаётся как отдала панель.
 */

const ENCODE_PREFIX = 'rwEncodeBase64:';

function b64(text) {
  return `base64:${Buffer.from(text, 'utf8').toString('base64')}`;
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 GB';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
}

<<<<<<< HEAD
function unix(d) {
  return d ? String(Math.floor(d.getTime() / 1000)) : '';
}

function fmtDate(d) {
  return d ? d.toLocaleString('ru-RU') : '';
}

// Ближайший сброс трафика по стратегии пользователя (приблизительно, UTC).
function nextReset(strategy, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (strategy === 'DAY') return new Date(Date.UTC(y, m, d + 1));
  if (strategy === 'WEEK') return new Date(Date.UTC(y, m, d + (8 - (now.getUTCDay() || 7))));
  if (strategy === 'MONTH') return new Date(Date.UTC(y, m + 1, 1));
  return null;
}

function buildVars(settings, ctx) {
  const u = ctx.user || {};
  const expire = u.expireAt ? new Date(u.expireAt) : null;
  const created = u.createdAt ? new Date(u.createdAt) : null;
  const lastReset = u.lastTrafficResetAt ? new Date(u.lastTrafficResetAt) : null;
  const strategy = u.trafficLimitStrategy || '';
  const next = nextReset(strategy);
  const daysLeft = expire ? Math.max(0, Math.ceil((expire.getTime() - Date.now()) / 86400000)) : '∞';
  const used = u.usedTrafficBytes || 0;
  const limit = u.trafficLimitBytes || 0;
  const left = limit ? Math.max(0, limit - used) : 0;
  return {
    DAYS_LEFT: String(daysLeft),
    TRAFFIC_USED: fmtBytes(used),
    TRAFFIC_LEFT: limit ? fmtBytes(left) : '∞',
    TOTAL_TRAFFIC: limit ? fmtBytes(limit) : '∞',
    TRAFFIC_LIMIT: limit ? fmtBytes(limit) : '∞', // синоним TOTAL_TRAFFIC
    STATUS: u.status || '',
    USERNAME: u.username || '',
    EMAIL: u.email || '',
    TELEGRAM_ID: u.telegramId != null ? String(u.telegramId) : '',
    SUBSCRIPTION_URL: ctx.subscriptionUrl || '',
    TAG: u.tag || '',
    EXPIRE_UNIX: unix(expire),
    EXPIRE_DATE: expire ? expire.toLocaleDateString('ru-RU') : '∞',
    SHORT_UUID: ctx.shortUuid || '',
    ID: u.id != null ? String(u.id) : '',
    TRAFFIC_USED_BYTES: String(used),
    TRAFFIC_LEFT_BYTES: limit ? String(left) : '0',
    TOTAL_TRAFFIC_BYTES: String(limit),
    RESET_STRATEGY: strategy,
    LIFETIME_USED_BYTES: String(u.lifetimeUsedTrafficBytes || 0),
    CREATED_AT_UNIX: unix(created),
    LAST_TRAFFIC_RESET_AT_UNIX: unix(lastReset),
    LAST_TRAFFIC_RESET_AT: fmtDate(lastReset),
    NEXT_TRAFFIC_RESET_AT_UNIX: unix(next),
    NEXT_TRAFFIC_RESET_AT: fmtDate(next),
    SS_HWID_LIMIT: u.hwidDeviceLimit != null ? String(u.hwidDeviceLimit) : '',
    DESCRIPTION: u.description || '',
=======
function buildVars(settings, ctx) {
  const u = ctx.user || {};
  const expire = u.expireAt ? new Date(u.expireAt) : null;
  const daysLeft = expire ? Math.max(0, Math.ceil((expire.getTime() - Date.now()) / 86400000)) : '∞';
  return {
    DAYS_LEFT: String(daysLeft),
    USERNAME: u.username || '',
    EMAIL: u.email || '',
    TELEGRAM_ID: u.telegramId != null ? String(u.telegramId) : '',
    TAG: u.tag || '',
    STATUS: u.status || '',
    TRAFFIC_USED: fmtBytes(u.usedTrafficBytes),
    TRAFFIC_LIMIT: u.trafficLimitBytes ? fmtBytes(u.trafficLimitBytes) : '∞',
    EXPIRE_DATE: expire ? expire.toLocaleDateString('ru-RU') : '∞',
    SUBSCRIPTION_URL: ctx.subscriptionUrl || '',
    SHORT_UUID: ctx.shortUuid || '',
>>>>>>> ebaca8d9d453828eb4f5f28d405e7496f786907e
    BRAND: settings.brandName || '',
  };
}

// Возвращает { text, encode } — encode=true, если шаблон начинался с rwEncodeBase64:
function render(template, vars) {
  let t = String(template || '').trim();
  let encode = false;
  if (t.startsWith(ENCODE_PREFIX)) {
    encode = true;
    t = t.slice(ENCODE_PREFIX.length);
  }
  // {{STATUS:ACTIVE=...|EXPIRED=...}}
  t = t.replace(/\{\{\s*STATUS:([^}]*)\}\}/g, (m, map) => {
    for (const part of map.split('|')) {
      const idx = part.indexOf('=');
      if (idx > 0 && part.slice(0, idx).trim() === vars.STATUS) return part.slice(idx + 1);
    }
    return '';
  });
  t = t.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (m, key) => (key in vars ? vars[key] : m));
  t = t.replace(/\{username\}/g, vars.USERNAME).replace(/\{brand\}/g, vars.BRAND);
  return { text: t.trim(), encode };
}

function needsUser(settings) {
  return [settings.profileTitle, settings.announce, settings.customHeadersJson].some(
    (v) => typeof v === 'string' && (v.includes('{{') || v.includes('{username}'))
  );
}

function applyHeaderOverrides(headers, settings, ctx) {
  const out = { ...headers };
  const vars = buildVars(settings, ctx);

  // profile-title и announce всегда уходят в base64 (в них бывают эмодзи/кириллица)
  [['profile-title', settings.profileTitle], ['announce', settings.announce]].forEach(([name, tpl]) => {
    const r = render(tpl, vars);
    if (r.text) out[name] = r.text.startsWith('base64:') ? r.text : b64(r.text);
  });

  const interval = String(settings.profileUpdateInterval || '').trim();
  if (interval) out['profile-update-interval'] = interval;

  const domain = (settings.subscriptionDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain) out['profile-web-page-url'] = `https://${domain}/${ctx.shortUuid}`;

  if (settings.customHeadersJson && settings.customHeadersJson.trim()) {
    try {
      const custom = JSON.parse(settings.customHeadersJson);
      Object.entries(custom).forEach(([k, v]) => {
        const r = render(v, vars);
        if (!r.text) return;
        out[k.toLowerCase()] = r.encode ? b64(r.text) : r.text;
      });
    } catch (e) {
      console.error('[headers] customHeadersJson некорректен:', e.message);
    }
  }
  return out;
}

module.exports = { applyHeaderOverrides, needsUser };
