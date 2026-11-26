(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var icon = document.getElementById('themeIcon');
  var stored = null;
  try { stored = localStorage.getItem('field-manual-theme'); } catch (e) {}

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    var dark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    icon.textContent = dark ? '◑' : '◐';
    try { localStorage.setItem('field-manual-theme', theme); } catch (e) {}
  }

  setTheme(stored === 'dark' || stored === 'light' ? stored : 'light');
  toggle.addEventListener('click', function () {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var links = Array.prototype.slice.call(document.querySelectorAll('#nav a'));
  var sections = links.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  }).filter(Boolean);

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  var search = document.getElementById('navSearch');
  search.addEventListener('input', function () {
    var query = search.value.trim().toLowerCase();
    links.forEach(function (link) {
      var match = !query || link.textContent.toLowerCase().indexOf(query) !== -1;
      link.classList.toggle('hidden', !match);
    });
  });
  search.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); }
  });

  document.querySelectorAll('.copy').forEach(function (button) {
    button.addEventListener('click', function () {
      var pre = button.parentElement.querySelector('pre');
      if (!pre) return;
      var text = pre.innerText;
      function copied() {
        var label = button.textContent;
        button.textContent = 'Copied';
        button.classList.add('done');
        setTimeout(function () {
          button.textContent = label;
          button.classList.remove('done');
        }, 1400);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copied, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); copied(); } catch (e) {}
        document.body.removeChild(area);
      }
    });
  });
})();
