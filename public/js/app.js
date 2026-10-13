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

      // "Добавить подписку" — это deep-link (happ://add/..., incy://crypt1/...),
      // он не зависит от платформы и может быть зашифрован сервером заранее,
      // поэтому при смене платформы трогаем только кнопку "Установить".
      (appsData.apps || []).forEach(function (app) {
        var card = document.querySelector('.app-guide-card[data-app-id="' + app.id + '"]');
        if (!card) return;
        var install = (app.install && (app.install[platform] || app.install.android || app.install.ios)) || '';
        var installBtn = card.querySelector('.app-install-btn');
        if (installBtn) installBtn.href = install;
      });
    }

    document.querySelectorAll('.platform-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPlatform(btn.getAttribute('data-platform'));
      });
    });
  }

  // Кнопка "Копировать" у каждого блока кода в инструкциях (markdown <pre>)
  document.querySelectorAll('.markdown-body pre').forEach(function (pre) {
    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary code-copy';
    btn.title = 'Копировать';
    btn.setAttribute('aria-label', 'Копировать');
    btn.innerHTML = ICON_COPY;
    wrap.appendChild(btn);
    btn.addEventListener('click', function () {
      var text = pre.innerText.replace(/\s+$/, '');
      var done = function () {
        btn.innerHTML = ICON_OK;
        setTimeout(function () { btn.innerHTML = ICON_COPY; }, 1500);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      }
    });
  });

  // Админка: предупреждаем о слишком большом файле ДО отправки формы
  // (иначе реверс-прокси отвечает 413, и приложение даже не видит запрос).
  document.querySelectorAll('input[type=file][data-max-kb]').forEach(function (input) {
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      var max = parseInt(input.getAttribute('data-max-kb'), 10);
      if (f && f.size > max * 1024) {
        alert('Файл ' + Math.round(f.size / 1024) + ' КБ — больше ' + max + ' КБ. ' +
          'Уменьшите изображение или увеличьте client_max_body_size в реверс-прокси.');
        input.value = '';
      }
    });
  });

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
