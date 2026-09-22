document.addEventListener('DOMContentLoaded', function () {
  // Переключение вкладок
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('tab-' + target);
      if (panel) panel.classList.add('active');
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
