/**
 * Шифрованные deep-link'и для кнопки "Добавить подписку" — скрывают от
 * пользователя сырой URL подписки. Используем официальные механизмы
 * Happ и INCY.
 *
 * Если шифрование недоступно — возвращаем null, вызывающий код откатывается
 * на обычный `scheme://add/{url}`. Причина сбоя ВСЕГДА пишется в лог
 * контейнера ([cryptoLinks] ...) и видна на странице /admin/test-crypto.
 */

const HAPP_CRYPTO_API = 'https://crypto.happ.su/api-v2.php';
const HAPP_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const happCache = new Map(); // url -> { link, expires }

/**
 * Один запрос к crypto.happ.su. Возвращает подробный результат для
 * диагностики: { link, status, contentType, bodySnippet, error }.
 */
async function requestHappCrypto(subscriptionUrl) {
  const result = { link: null, status: null, contentType: null, bodySnippet: '', error: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HAPP_TIMEOUT_MS);
  try {
    const res = await fetch(HAPP_CRYPTO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        // Часть публичных API за WAF режет запросы без браузерного UA.
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Origin: 'https://crypto.happ.su',
        Referer: 'https://crypto.happ.su/',
      },
      body: JSON.stringify({ url: subscriptionUrl }),
      signal: controller.signal,
    });
    result.status = res.status;
    result.contentType = res.headers.get('content-type') || '';
    const text = (await res.text()).trim();
    result.bodySnippet = text.slice(0, 300);

    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      return result;
    }
    if (/text\/html/i.test(result.contentType)) {
      result.error = 'Получен HTML вместо ответа API (похоже на WAF/блокировку)';
      return result;
    }

    // 1) Самый надёжный способ — найти готовый токен вида crypt4/... или crypt5/...
    //    в любом месте ответа, независимо от обёртки (JSON/текст).
    const unescaped = text.replace(/\\\//g, '/');
    const m = unescaped.match(/(?:happ:\/\/)?(crypt\d+\/[A-Za-z0-9+/=_\-.]+)/);
    if (m) {
      result.link = `happ://${m[1]}`;
      return result;
    }

    // 2) JSON с известными полями.
    try {
      const json = JSON.parse(text);
      const candidate =
        json.link || json.url || json.encrypted_link || json.encryptedUrl ||
        json.encrypted || json.data || json.result || json.crypt;
      if (typeof candidate === 'string' && candidate.startsWith('happ://')) {
        result.link = candidate;
        return result;
      }
    } catch (e) {
      // не JSON
    }

    result.error = 'Не удалось распознать зашифрованную ссылку в ответе';
    return result;
  } catch (err) {
    result.error = err.name === 'AbortError' ? `Таймаут ${HAPP_TIMEOUT_MS} мс` : err.message;
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function getHappCryptLink(subscriptionUrl) {
  if (!subscriptionUrl) return null;

  const cached = happCache.get(subscriptionUrl);
  if (cached && cached.expires > Date.now()) return cached.link;

  const r = await requestHappCrypto(subscriptionUrl);
  if (r.link) {
    happCache.set(subscriptionUrl, { link: r.link, expires: Date.now() + CACHE_TTL_MS });
    return r.link;
  }
  console.error(
    `[cryptoLinks] Happ crypto не сработал: ${r.error}; status=${r.status}; ` +
      `content-type=${r.contentType}; body="${r.bodySnippet}"`
  );
  return null;
}

/**
 * INCY: crypt1 (AES-256-GCM), локально, через npm-пакет @incy/link-encoder.
 * Пакет опциональный: `npm install @incy/link-encoder` и пересборка образа.
 */
let incyEncoder = null;
function loadIncyEncoder() {
  if (incyEncoder !== null) return incyEncoder;
  try {
    // eslint-disable-next-line global-require
    incyEncoder = require('@incy/link-encoder');
  } catch (e) {
    console.error('[cryptoLinks] Пакет @incy/link-encoder не установлен — INCY-ссылки будут незашифрованными');
    incyEncoder = false;
  }
  return incyEncoder;
}

function getIncyCryptLink(subscriptionUrl, name) {
  if (!subscriptionUrl) return null;
  const encoder = loadIncyEncoder();
  if (!encoder) return null;
  try {
    return encoder.encryptLink(subscriptionUrl, name ? { name } : undefined);
  } catch (err) {
    console.error('[cryptoLinks] Не удалось зашифровать INCY-ссылку:', err.message);
    return null;
  }
}

module.exports = { getHappCryptLink, getIncyCryptLink, requestHappCrypto };
