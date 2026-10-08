const config = require('./config');

/**
 * Тонкий клиент к panel API Remnawave.
 *
 * Используются два вида ручек:
 *  - Админские (`/api/users/...`, `/api/subscriptions/connection-keys/...`) —
 *    требуют Bearer-токен, вызываются ТОЛЬКО отсюда, с бэкенда.
 *  - Публичная (`/api/sub/{shortUuid}`) — без авторизации, используется для
 *    прозрачного проброса (passthrough) сырой подписки нетбраузерным клиентам
 *    (см. proxyRawSubscription) — ровно то же самое, что дёргают VPN-приложения
 *    напрямую у панели.
 */

async function apiFetch(path, { auth = false, headers = {} } = {}) {
  if (!config.remnawave.apiUrl) {
    throw new Error('REMNAWAVE_API_URL не задан в .env');
  }
  const url = `${config.remnawave.apiUrl}${path}`;
  const finalHeaders = { Accept: 'application/json', ...headers };
  if (auth) {
    if (!config.remnawave.apiToken) {
      throw new Error('REMNAWAVE_API_TOKEN не задан в .env');
    }
    finalHeaders.Authorization = `Bearer ${config.remnawave.apiToken}`;
  }

  const res = await fetch(url, { headers: finalHeaders });
  return res;
}

/**
 * Достаём пользователя по shortUuid из его ссылки-подписки, чтобы узнать
 * tag, активные squad'ы и числовой id (нужен для /connection-keys).
 * Возвращает null, если пользователь не найден.
 */
async function getUserByShortUuid(shortUuid) {
  const res = await apiFetch(`/api/users/by-short-uuid/${encodeURIComponent(shortUuid)}`, {
    auth: true,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Remnawave API /users/by-short-uuid ответил ${res.status}`);
  }
  const body = await res.json();
  return body.response || body;
}

/**
 * Официальная ручка панели для получения реальных ключей подключения
 * пользователя: GET /api/subscriptions/connection-keys/{userId}
 * (числовой id, не shortUuid/uuid — см. OpenAPI-спеку панели 3.x).
 * Возвращает только enabledKeys — активные ключи, которые имеет смысл
 * показывать пользователю. disabledKeys/hiddenKeys сознательно не отдаём:
 * disabled — неактивные хосты, hidden — служебные (injectHosts), не для
 * ручной вставки в клиент.
 */
async function getConnectionKeys(userId) {
  if (!userId && userId !== 0) return [];
  const res = await apiFetch(`/api/subscriptions/connection-keys/${encodeURIComponent(userId)}`, {
    auth: true,
  });
  if (!res.ok) {
    console.error(`[remnawaveClient] /connection-keys/${userId} ответил ${res.status}`);
    return [];
  }
  const body = await res.json();
  const data = body.response || body;
  return (data.enabledKeys || []).filter((k) => typeof k === 'string' && k.trim().length > 0);
}

function buildSubscriptionUrl(shortUuid) {
  if (!config.remnawave.subPublicDomain) return '';
  return `https://${config.remnawave.subPublicDomain}/${shortUuid}`;
}

// Заголовки, которые нельзя слепо копировать между upstream- и downstream-
// ответом при проксировании (управляются самим HTTP-сервером/Node).
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

/**
 * Прозрачно пробрасывает запрос к панели на /api/sub/{shortUuid} и
 * возвращает статус/заголовки/тело как есть — байт в байт. Нужно для того,
 * чтобы наш сервис мог быть ЕДИНСТВЕННЫМ доменом подписки: VPN-приложения
 * (не браузеры) получают настоящий конфиг от панели (с её Content-Type и
 * служебными заголовками вроде profile-title), а не нашу HTML-страницу.
 */
async function proxyRawSubscription(shortUuid, { userAgent, accept } = {}) {
  if (!config.remnawave.apiUrl) {
    throw new Error('REMNAWAVE_API_URL не задан в .env');
  }
  const url = `${config.remnawave.apiUrl}/api/sub/${encodeURIComponent(shortUuid)}`;
  const upstream = await fetch(url, {
    headers: {
      ...(userAgent ? { 'User-Agent': userAgent } : {}),
      ...(accept ? { Accept: accept } : {}),
    },
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
  });
  return { status: upstream.status, headers, body };
}

module.exports = {
  getUserByShortUuid,
  getConnectionKeys,
  buildSubscriptionUrl,
  proxyRawSubscription,
};
