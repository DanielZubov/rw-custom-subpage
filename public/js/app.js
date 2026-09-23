document.addEventListener('DOMContentLoaded', function () {
  // Переключение платформы на вкладке "Устройства" (без перезагрузки страницы) —
  // данные всех приложений/ссылок лежат в #apps-data, отрисованном сервером.
  var appsDataEl = document.getElementById('apps-data');
  if (appsDataEl) {
    var appsData = null;
    try { appsData = JSON.parse(appsDataEl.textContent); } catch (e) { appsData = null; }

    var PLATFORM_LABELS = { ios: 'iOS', android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux' };

    function applyPlatform(platform) {
      if (!appsData) return;
      var label = document.getElementById('detected-platform-label');
      if (label && PLATFORM_LABELS[platform]) label.textContent = PLATFORM_LABELS[platform];

      document.querySelectorAll('.platform-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-platform') === platform);
      });

      (appsData.apps || []).forEach(function (app) {
        var card = document.querySelector('.app-guide-card[data-app-id="' + app.id + '"]');
        if (!card) return;
        var install = (app.install && (app.install[platform] || app.install.android || app.install.ios)) || '';
        var add = appsData.subscriptionUrl && app.addScheme
          ? app.addScheme.replace('{url}', appsData.subscriptionUrl)
          : '';
        var installBtn = card.querySelector('.app-install-btn');
        var addBtn = card.querySelector('.app-add-btn');
        if (installBtn) installBtn.href = install;
        if (addBtn) addBtn.href = add;
      });
    }

    document.querySelectorAll('.platform-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPlatform(btn.getAttribute('data-platform'));
      });
    });
  }

  // Копирование в буфер обмена
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var selector = btn.getAttribute('data-copy');
      var input = document.querySelector(selector);
      if (!input) return;
      var text = input.value;
      var done = function () {
        var original = btn.textContent;
        btn.textContent = 'Скопировано ✓';
        setTimeout(function () { btn.textContent = original; }, 1500);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          input.select();
          document.execCommand('copy');
          done();
        });
      } else {
        input.select();
        document.execCommand('copy');
        done();
      }
    });
  });
});
