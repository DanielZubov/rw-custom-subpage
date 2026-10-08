/**
 * Шифрованные deep-link'и для кнопки "Добавить подписку" — скрывают от
 * пользователя сырой URL подписки (п.2 требований). Для обоих провайдеров
 * используем ИХ ЖЕ официальные, задокументированные механизмы, а не
 * самодельную криптографию — так ссылки гарантированно откроются в
 * актуальных версиях приложений.
 *
 * Если шифрование недоступно (нет сети до happ.su, пакет @incy/link-encoder
 * не установлен и т.п.) — отдаём null, и вызывающий код должен откатиться
 * на обычный незашифрованный `happ://add/{url}` / `incy://add/{url}`.
 * Страница пользователя не должна падать из-за недоступности сервиса
 * шифрования.
 */

const HAPP_CRYPTO_API = 'https://crypto.happ.su/api-v2.php';
const HAPP_TIMEOUT_MS = 3000;

/**
 * Happ: официальный онлайн-энкодер (RSA-4096, happ://crypt4/...).
 * См. https://www.happ.su/main/dev-docs/crypto-link
 */
async function getHappCryptLink(subscriptionUrl) {
  if (!subscriptionUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HAPP_TIMEOUT_MS);
  try {
    const res = await fetch(HAPP_CRYPTO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: subscriptionUrl }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`crypto.happ.su ответил ${res.status}`);

    const text = (await res.text()).trim();
    let payload = text;
    // API может вернуть либо чистый JSON-объект с готовой ссылкой/пейлоадом,
    // либо просто голую строку — обрабатываем оба случая.
    try {
      const json = JSON.parse(text);
      payload = json.link || json.url || json.data || json.result || json.crypt || text;
    } catch (e) {
      // не JSON — используем как есть (голый зашифрованный payload)
    }

    if (!payload) return null;
    if (payload.startsWith('happ://')) return payload;
    return `happ://crypt4/${payload}`;
  } catch (err) {
    console.error('[cryptoLinks] Не удалось получить Happ crypto link:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * INCY: официальный crypt1 (AES-256-GCM, ключ "зашит" в приложение и
 * опубликован как npm-пакет @incy/link-encoder — шифрование чисто
 * локальное, без сетевого вызова). См. https://docs.incy.cc/en/deep-links/
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

module.exports = { getHappCryptLink, getIncyCryptLink };
