const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const config = require('../config');
const { getSettings, saveSettings, DEFAULT_SETTINGS, UPLOADS_DIR } = require('../db');

const router = express.Router();

router.use(
  basicAuth({
    users: { [config.admin.login]: config.admin.password },
    challenge: true,
    realm: 'LeonVPN Admin',
  })
);

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/svg+xml']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 МБ достаточно для лого/favicon
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('Разрешены только изображения: PNG, JPEG, WebP, SVG, ICO'));
    }
    cb(null, true);
  },
});

router.get('/', (req, res) => {
  res.render('admin/dashboard', { settings: getSettings(), saved: false, error: null });
});

router.post(
  '/',
  (req, res, next) => {
    upload.fields([{ name: 'logoFile', maxCount: 1 }, { name: 'faviconFile', maxCount: 1 }])(
      req,
      res,
      (err) => {
        if (err) {
          return res.status(400).render('admin/dashboard', {
            settings: getSettings(),
            saved: false,
            error: `Не удалось загрузить файл: ${err.message}`,
          });
        }
        next();
      }
    );
  },
  (req, res) => {
    const body = req.body;

    let apps = DEFAULT_SETTINGS.apps;
    try {
      if (body.appsJson && body.appsJson.trim()) {
        const parsed = JSON.parse(body.appsJson);
        if (!Array.isArray(parsed)) throw new Error('apps must be an array');
        apps = parsed;
      }
    } catch (e) {
      return res.status(400).render('admin/dashboard', {
        settings: getSettings(),
        saved: false,
        error: `Не удалось разобрать JSON со списком приложений: ${e.message}`,
      });
    }

    // Файл, если загружен, побеждает текстовое поле со ссылкой.
    const logoFile = req.files && req.files.logoFile && req.files.logoFile[0];
    const faviconFile = req.files && req.files.faviconFile && req.files.faviconFile[0];
    const logoUrl = logoFile ? `/uploads/${logoFile.filename}` : body.logoUrl || '';
    const faviconUrl = faviconFile ? `/uploads/${faviconFile.filename}` : body.faviconUrl || '';

    const updated = saveSettings({
      brandName: body.brandName || DEFAULT_SETTINGS.brandName,
      siteTitle: body.siteTitle || DEFAULT_SETTINGS.siteTitle,
      logoUrl,
      faviconUrl,
      primaryColor: body.primaryColor || DEFAULT_SETTINGS.primaryColor,
      accentColor: body.accentColor || DEFAULT_SETTINGS.accentColor,
      supportUrl: body.supportUrl || '',
      footerText: body.footerText || '',
      showSubscriptionLinkOnDevicesTab: body.showSubscriptionLinkOnDevicesTab === 'on',
      routerKeyword: body.routerKeyword || DEFAULT_SETTINGS.routerKeyword,
      routerInstructionsMarkdown: body.routerInstructionsMarkdown || '',
      apps,
    });

    res.render('admin/dashboard', { settings: updated, saved: true, error: null });
  }
);

module.exports = router;
