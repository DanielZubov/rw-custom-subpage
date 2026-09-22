const express = require('express');
const { marked } = require('marked');
const rw = require('../remnawaveClient');
const { getSettings } = require('../db');

const router = express.Router();

// Короткий UUID Remnawave — обычный uuid v4. На всякий случай не пускаем
// в API мусор из URL (например, запросы браузера на /favicon.ico).
const SHORT_UUID_RE = /^[a-zA-Z0-9-]{6,64}$/;

function isRouterUser(user, keyword) {
  if (!keyword) return false;
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;

  const tag = (user.tag || '').toLowerCase();
  if (tag.includes(needle)) return true;

  const squads = user.activeInternalSquads || [];
  return squads.some((squad) => (squad.name || '').toLowerCase().includes(needle));
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 ГБ';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} ГБ`;
}

router.get('/:shortUuid', async (req, res, next) => {
  const { shortUuid } = req.params;
  const settings = getSettings();

  if (!SHORT_UUID_RE.test(shortUuid)) {
    return res.status(404).render('errors/not-found', { settings });
  }

  try {
    const user = await rw.getUserByShortUuid(shortUuid);
    if (!user) {
      return res.status(404).render('errors/not-found', { settings });
    }

    const [rawKeys] = await Promise.all([rw.getRawKeys(shortUuid)]);
    const subscriptionUrl = rw.buildSubscriptionUrl(shortUuid);
    const showRouterTab = isRouterUser(user, settings.routerKeyword);

    res.render('subscription', {
      settings,
      user,
      subscriptionUrl,
      rawKeys,
      showRouterTab,
      routerInstructionsHtml: showRouterTab
        ? marked.parse(settings.routerInstructionsMarkdown || '')
        : '',
      formatBytes,
      trafficUsed: formatBytes(user.usedTrafficBytes),
      trafficLimit: user.trafficLimitBytes ? formatBytes(user.trafficLimitBytes) : 'Безлимит',
      expireAt: user.expireAt ? new Date(user.expireAt) : null,
      isActive: user.status === 'ACTIVE',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
