require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Не роняем процесс сразу — даём странице подписки шанс показать
    // внятную ошибку конфигурации вместо падения контейнера в рестарт-луп.
    console.error(`[config] Внимание: переменная окружения ${name} не задана`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '3010', 10),

  remnawave: {
    apiUrl: (required('REMNAWAVE_API_URL', '') || '').replace(/\/+$/, ''),
    apiToken: required('REMNAWAVE_API_TOKEN', ''),
    subPublicDomain: (process.env.SUB_PUBLIC_DOMAIN || '').replace(/\/+$/, ''),
  },

  routerKeywordDefault: process.env.ROUTER_KEYWORD || 'ROUTER',

  admin: {
    login: process.env.ADMIN_LOGIN || 'admin',
    password: process.env.ADMIN_PASSWORD || 'change-me-please',
  },
};
