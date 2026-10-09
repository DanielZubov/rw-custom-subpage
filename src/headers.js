/**
 * Переписывает служебные заголовки подписки, которые читают VPN-клиенты
 * (Happ, INCY и др.): profile-title, announce, profile-update-interval,
 * profile-web-page-url, support-url + произвольные из настроек.
 * Всё, что не задано в настройках, остаётся как отдала панель.
 */

function b64(text) {
  return `base64:${Buffer.from(text, 'utf8').toString('base64')}`;
}

function fill(template, ctx) {
  return String(template || '')
    .replace(/\{username\}/g, ctx.username || '')
    .replace(/\{brand\}/g, ctx.brand || '')
    .trim();
}

function needsUsername(settings) {
  return [settings.profileTitle, settings.announce, settings.customHeadersJson].some(
    (v) => typeof v === 'string' && v.includes('{username}')
  );
}

function applyHeaderOverrides(headers, settings, ctx) {
  const out = { ...headers };
  const c = { username: ctx.username, brand: settings.brandName };

  const title = fill(settings.profileTitle, c);
  if (title) out['profile-title'] = b64(title);

  const announce = fill(settings.announce, c);
  if (announce) out['announce'] = b64(announce);

  const interval = String(settings.profileUpdateInterval || '').trim();
  if (interval) out['profile-update-interval'] = interval;

  const domain = (settings.subscriptionDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain) out['profile-web-page-url'] = `https://${domain}/${ctx.shortUuid}`;

  if (settings.supportUrl) out['support-url'] = settings.supportUrl;

  if (settings.customHeadersJson && settings.customHeadersJson.trim()) {
    try {
      const custom = JSON.parse(settings.customHeadersJson);
      Object.entries(custom).forEach(([k, v]) => {
        const val = fill(v, c);
        if (val) out[k.toLowerCase()] = val;
      });
    } catch (e) {
      console.error('[headers] customHeadersJson некорректен:', e.message);
    }
  }
  return out;
}

module.exports = { applyHeaderOverrides, needsUsername };
