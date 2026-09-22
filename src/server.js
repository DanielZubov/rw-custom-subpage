const path = require('path');
const express = require('express');
const config = require('./config');
const { getSettings } = require('./db');

const subscriptionRoutes = require('./routes/subscription');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.json({ limit: '512kb' }));
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Простая проверка живости для реверс-прокси/докера
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => {
  res.render('index', { settings: getSettings() });
});

app.use('/admin', adminRoutes);

// Короткий UUID подписки — последним, чтобы не перехватывать /admin, /static и т.д.
app.use('/', subscriptionRoutes);

app.use((req, res) => {
  res.status(404).render('errors/not-found', { settings: getSettings() });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Ошибка обработки запроса:', err);
  res.status(500).render('errors/server-error', {
    settings: getSettings(),
    message: err.message,
  });
});

app.listen(config.port, () => {
  console.log(`LeonVPN subscription page слушает порт ${config.port}`);
  if (!config.remnawave.apiUrl || !config.remnawave.apiToken) {
    console.warn('[server] REMNAWAVE_API_URL / REMNAWAVE_API_TOKEN не заданы — страница подписки не будет работать, пока вы не заполните .env');
  }
});
