const express = require('express');
const basicAuth = require('express-basic-auth');
const config = require('../config');
const { getSettings, saveSettings, DEFAULT_SETTINGS } = require('../db');

const router = express.Router();

router.use(
  basicAuth({
    users: { [config.admin.login]: config.admin.password },
    challenge: true,
    realm: 'LeonVPN Admin',
  })
);

router.get('/', (req, res) => {
  res.render('admin/dashboard', { settings: getSettings(), saved: false, error: null });
});

router.post('/', (req, res) => {
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

  const updated = saveSettings({
    brandName: body.brandName || DEFAULT_SETTINGS.brandName,
    siteTitle: body.siteTitle || DEFAULT_SETTINGS.siteTitle,
    logoUrl: body.logoUrl || '',
    primaryColor: body.primaryColor || DEFAULT_SETTINGS.primaryColor,
    accentColor: body.accentColor || DEFAULT_SETTINGS.accentColor,
    supportUrl: body.supportUrl || '',
    footerText: body.footerText || '',
    routerKeyword: body.routerKeyword || DEFAULT_SETTINGS.routerKeyword,
    routerInstructionsMarkdown: body.routerInstructionsMarkdown || '',
    apps,
  });

  res.render('admin/dashboard', { settings: updated, saved: true, error: null });
});

module.exports = router;
