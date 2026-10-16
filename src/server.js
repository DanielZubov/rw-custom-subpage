const path = require('path');
const express = require('express');
const config = require('./config');
const { getSettings } = require('./db');

const subscriptionRoutes = require('./routes/subscription');
const adminRoutes = require('./routes/admin');

const app = express();

// Лог запросов в stdout контейнера (docker logs). Токен подписки маскируем.
app.use((req, res, next) => {
  if (req.path.startsWith('/static') || req.path.startsWith('/uploads') || req.path === '/healthz') {
    return next();
  }
  const started = Date.now();
  res.on('finish', () => {
    const known = req.path === '/' || req.path.startsWith('/admin');
    const shown = known ? req.path : req.path.replace(/^\/([A-Za-z0-9_-]{3})[^/]*/, '/$1***');
    const ua = (req.headers['user-agent'] || '-').slice(0, 60);
    console.log(`${req.method} ${shown} ${res.statusCode} ${Date.now() - started}ms ua="${ua}"`);
  });
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.json({ limit: '512kb' }));
app.use('/static', express.static(path.join(__dirname, '..', 'public')));
// Локально загруженные через /admin логотип/favicon (persist-том data/uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

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
  console.log(`rw-custom-subpage слушает порт ${config.port}`);
  if (!config.remnawave.apiUrl || !config.remnawave.apiToken) {
    console.warn('[server] REMNAWAVE_API_URL / REMNAWAVE_API_TOKEN не заданы — страница подписки не будет работать, пока вы не заполните .env');
  }
});
