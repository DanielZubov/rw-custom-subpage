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
 *
 * ВАЖНО про User-Agent: панель выбирает формат ответа /api/sub/{shortUuid}
 * по заголовку User-Agent запроса (Mihomo/Xray-json/Sing-box/Base64, для
 * браузеров — отдельное поведение). Наш бэкенд сам не браузер и не один из
 * этих клиентов, поэтому явно представляемся обычным приложением, которое
 * панель понимает как "отдать построчный список ключей" — иначе можно
 * получить служебную заглушку вместо реальных ключей.
 */

const RAW_KEYS_USER_AGENT = 'Happ/4.9.0 (Linux; U; Android 13)';

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

// Панель отдаёт этот "шуточный" плейсхолдер-ключ, когда реальную
// конфигурацию построить не из чего (нет ни одного рабочего хоста
// в активных squad'ах пользователя) — вместо ошибки. Распознаём его по
// характерному адресу 0.0.0.0 и отфильтровываем, чтобы не показывать
// пользователю мусор вместо ключей.
function isPlaceholderKey(line) {
  return /@0\.0\.0\.0[:/]/i.test(line) || /uuid=00000000-0000-0000-0000-000000000000/i.test(line);
}

/**
 * Сырой список ключей подписки (vless://, ss:// и т.д.).
 * Используется для вкладки "Роутер", где ключи нужно показать текстом
 * для ручной вставки в Podkop/Forkop.
 */
async function getRawKeys(shortUuid) {
  const res = await apiFetch(`/api/sub/${encodeURIComponent(shortUuid)}`, {
    headers: { 'User-Agent': RAW_KEYS_USER_AGENT },
  });
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
    .filter((line) => line.length > 0 && line.includes('://'))
    .filter((line) => !isPlaceholderKey(line));
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
