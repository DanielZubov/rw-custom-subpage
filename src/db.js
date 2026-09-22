const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  brandName: 'LeonVPN',
  siteTitle: 'LeonVPN — моя подписка',
  logoUrl: '',
  primaryColor: '#6C5CE7',
  accentColor: '#00D1B2',
  supportUrl: 'https://t.me/leonvpn_support',
  footerText: '© LeonVPN. Все ключи доступны только вам по персональной ссылке.',

  // Ключевое слово для определения "роутерных" пользователей.
  // Ищем без учёта регистра в tag пользователя и в названиях его
  // активных Internal Squad'ов.
  routerKeyword: config.routerKeywordDefault || 'ROUTER',

  // Список приложений, которые показываем на обычной вкладке.
  apps: [
    { name: 'Happ', platform: 'iOS / Android / Windows / macOS', url: 'https://happ.su/' },
    { name: 'v2rayNG', platform: 'Android', url: 'https://github.com/2dust/v2rayNG/releases' },
    { name: 'Shadowrocket', platform: 'iOS', url: 'https://apps.apple.com/app/shadowrocket/id932747118' },
    { name: 'Karing', platform: 'iOS / Android / Windows / macOS', url: 'https://github.com/KaringX/karing/releases' },
    { name: 'NekoBox', platform: 'Windows / Linux', url: 'https://github.com/MatsuriDayo/nekoray/releases' },
  ],

  // Markdown-инструкция для вкладки "Роутер (OpenWRT)". Редактируется в /admin.
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

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  }
}

function getSettings() {
  ensureFile();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const saved = JSON.parse(raw);
    // Подмешиваем дефолты — так после обновления образа новые поля
    // (например, новое приложение по умолчанию) не потеряются молча.
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (e) {
    console.error('[db] Не удалось прочитать settings.json, используем значения по умолчанию', e);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  ensureFile();
  const current = getSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS };
