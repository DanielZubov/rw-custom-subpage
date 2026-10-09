const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Приложения по умолчанию — только Happ и INCY, как и просили.
// addScheme: шаблон deep-link'а для добавления подписки, {url} подставляется
// сырой (без урл-энкодинга) ссылкой на подписку — так ждут оба клиента.
const DEFAULT_APPS = [
  {
    id: 'happ',
    name: 'Happ',
    addScheme: 'happ://add/{url}',
    // Шифрует ссылку через официальный API crypto.happ.su (RSA-4096,
    // happ://crypt4/...). При недоступности сервиса — тихий откат на
    // обычный addScheme (plaintext add) без шифрования, страница не падает.
    cryptoProvider: 'happ',
    install: {
      ios: 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215',
      android: 'https://play.google.com/store/apps/details?id=com.happproxy',
      windows: 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe',
      macos: 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215',
      linux: 'https://github.com/Happ-proxy/happ-desktop/releases/latest',
    },
  },
  {
    id: 'incy',
    name: 'INCY',
    addScheme: 'incy://add/{url}',
    // Шифрует ссылку локально (без сети) через npm-пакет @incy/link-encoder
    // (crypt1, AES-256-GCM). Пакет не входит в обязательные зависимости —
    // если не установлен, тихий откат на обычный addScheme. Чтобы включить
    // шифрование: `npm install @incy/link-encoder` внутри проекта и
    // пересобрать образ.
    cryptoProvider: 'incy',
    install: {
      ios: 'https://apps.apple.com/app/incy/id6756943388',
      android: 'https://incy.cc/',
      windows: 'https://incy.cc/',
      macos: 'https://incy.cc/',
      linux: 'https://incy.cc/',
    },
  },
];

const DEFAULT_SETTINGS = {
  brandName: 'MyVPN',
  siteTitle: 'MyVPN — моя подписка',

  // Логотип/favicon: либо внешняя ссылка, либо локально загруженный файл
  // (тогда тут будет путь вида /uploads/xxxxx.png — см. admin.js).
  logoUrl: '',
  faviconUrl: '',

  primaryColor: '#6C5CE7',
  accentColor: '#00D1B2',
  supportUrl: 'https://t.me/myvpn_support',
  footerText: '© MyVPN. Все ключи доступны только вам по персональной ссылке.',

  // Домен, который попадает в ссылку подписки (кнопки "Добавить подписку",
  // отображаемая ссылка, profile-web-page-url). Пусто = берём
  // SUB_PUBLIC_DOMAIN из .env. Нужен, например, чтобы отдавать клиентам
  // CDN-домен для обхода белых списков.
  subscriptionDomain: '',

  // Заголовки ответа подписки для приложений (Happ, INCY и др.).
  // Пустое поле = заголовок остаётся как отдала панель (её шаблоны работают).
  // Поддерживается синтаксис панели: rwEncodeBase64:, {{DAYS_LEFT}}, {{STATUS:...}}.
  profileTitle: '',
  profileUpdateInterval: '',   // часы; пусто = как отдаёт панель
  announce: '',                // Happ/INCY показывают как объявление
  customHeadersJson: '',       // доп. заголовки: {"Header-Name": "value"}

  // Показывать ли сырую ссылку на подписку на вкладке "Устройства".
  // На вкладке "Роутер" ссылка показывается всегда — она нужна для Podkop/Forkop.
  showSubscriptionLinkOnDevicesTab: false,

  // Ключевое слово для определения "роутерных" пользователей.
  routerKeyword: config.routerKeywordDefault || 'ROUTER',

  apps: DEFAULT_APPS,

  routerInstructionsMarkdown: `### Установка Podkop на OpenWRT

1. Подключитесь к роутеру по SSH.
2. Выполните автоматический установщик:

\`\`\`
sh <(wget -O - https://raw.githubusercontent.com/itdoginfo/podkop/refs/heads/main/install.sh)
\`\`\`

3. Скрипт спросит, через какой туннель работать — выберите свой вариант
   (VLESS/Xray и т.п.) и поставит нужные пакеты сам.
4. Откройте LuCI → **Services → Podkop** и вставьте вашу ссылку на подписку
   (она ниже, на этой странице) в поле подписки.
5. Сохраните и примените — Podkop сам заберёт список серверов и настроит
   sing-box.

### Форк Podkop (Forkop)

Если вы используете форк — процесс идентичен: ссылка на подписку и отдельные
ключи ниже подходят для любого клиента, который умеет читать формат
Xray/VLESS-ссылок. Уточните команду установки в репозитории вашего форка.

> Не можете разобраться? Напишите в поддержку — ссылка внизу страницы.`,
};

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  }
}

// Апгрейд настроек, сохранённых старой версией приложения (формат apps был
// { name, platform, url } — без install/addScheme). Если находим старый
// формат, тихо подменяем на новые дефолтные приложения, чтобы страница не
// падала на undefined.
function migrateApps(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return DEFAULT_APPS;
  const looksNew = apps.every((a) => a && typeof a === 'object' && a.install && a.addScheme);
  if (!looksNew) return DEFAULT_APPS;
  // settings.json, сохранённый прошлой версией, не содержит cryptoProvider —
  // достраиваем его по id (happ/incy). Значение "none" отключает шифрование.
  return apps.map((a) => {
    if (a.cryptoProvider !== undefined) return a;
    const def = DEFAULT_APPS.find((d) => d.id === a.id);
    return def && def.cryptoProvider ? { ...a, cryptoProvider: def.cryptoProvider } : a;
  });
}

function getSettings() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const saved = JSON.parse(raw);
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    merged.apps = migrateApps(merged.apps);
    return merged;
  } catch (e) {
    console.error('[db] Не удалось прочитать settings.json, используем значения по умолчанию', e);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  ensureDirs();
  const current = getSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS, UPLOADS_DIR };
