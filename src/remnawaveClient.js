const config = require('./config');

/**
 * Тонкий клиент к panel API Remnawave.
 *
 * Используются два вида ручек:
 *  - Админские (`/api/users/...`) — требуют Bearer-токен, вызываются ТОЛЬКО
 *    отсюда, с бэкенда. Нужны, чтобы узнать tag и активные Internal Squad'ы
 *    пользователя по shortUuid (в публичном /api/sub этого нет).
 *  - Публичные (`/api/sub/...`) — без авторизации, ровно то же самое, что
 *    дергает официальная remnawave/subscription-page и клиентские приложения.
 */

async function apiFetch(path, { auth = false } = {}) {
  if (!config.remnawave.apiUrl) {
    throw new Error('REMNAWAVE_API_URL не задан в .env');
  }
  const url = `${config.remnawave.apiUrl}${path}`;
  const headers = { Accept: 'application/json' };
  if (auth) {
    if (!config.remnawave.apiToken) {
      throw new Error('REMNAWAVE_API_TOKEN не задан в .env');
    }
    headers.Authorization = `Bearer ${config.remnawave.apiToken}`;
  }

  const res = await fetch(url, { headers });
  return res;
}

/**
 * Достаём пользователя по shortUuid из его ссылки-подписки, чтобы узнать
 * tag и активные squad'ы. Требует API-токен.
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
  // Контракт панели заворачивает объект в { response: {...} }
  return body.response || body;
}

/**
 * Метаданные подписки (заголовки профиля и т.п.) — публичная ручка,
 * не требует токена. Используется как резерв/доп.источник, необязателен
 * для отрисовки страницы.
 */
async function getSubscriptionInfo(shortUuid) {
  const res = await apiFetch(`/api/sub/${encodeURIComponent(shortUuid)}/info`);
  if (!res.ok) return null;
  const body = await res.json();
  return body.response || body;
}

/**
 * Сырой список ключей подписки (vless://, ss:// и т.д.), в формате base64
 * — тот же ответ, что получает клиент с неопознанным User-Agent.
 * Используется для вкладки "Роутер", где ключи нужно показать текстом
 * для ручной вставки в Podkop/Forkop.
 */
async function getRawKeys(shortUuid) {
  const res = await apiFetch(`/api/sub/${encodeURIComponent(shortUuid)}`);
  if (!res.ok) return [];
  const text = await res.text();
  let decoded = text;
  try {
    decoded = Buffer.from(text.trim(), 'base64').toString('utf8');
    // Если после декодирования получилась ерунда без "://" — значит сервер
    // и так отдал обычный текст, откатываемся на исходный ответ.
    if (!decoded.includes('://')) decoded = text;
  } catch (e) {
    decoded = text;
  }
  return decoded
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('://'));
}

function buildSubscriptionUrl(shortUuid) {
  if (!config.remnawave.subPublicDomain) return '';
  return `https://${config.remnawave.subPublicDomain}/${shortUuid}`;
}

module.exports = {
  getUserByShortUuid,
  getSubscriptionInfo,
  getRawKeys,
  buildSubscriptionUrl,
};
