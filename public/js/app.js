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
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary code-copy';
    btn.textContent = 'Копировать';
    wrap.appendChild(btn);
    btn.addEventListener('click', function () {
      var text = pre.innerText.replace(/\s+$/, '');
      var done = function () {
        btn.textContent = 'Скопировано ✓';
        setTimeout(function () { btn.textContent = 'Копировать'; }, 1500);
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
