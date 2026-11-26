(function () {
  'use strict';

  var root = document.documentElement;
  var announce = document.getElementById('announce');
  var searchInput = document.getElementById('siteSearch');
  var searchStatus = document.getElementById('searchStatus');
  var filterStatus = document.getElementById('filterStatus');
  var allItems = Array.prototype.slice.call(document.querySelectorAll('.searchable'));
  var templates = Array.prototype.slice.call(document.querySelectorAll('.template'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.group'));
  var details = Array.prototype.slice.call(document.querySelectorAll('details.item'));
  var techniques = Array.prototype.slice.call(document.querySelectorAll('.technique'));
  var activeCategory = 'all';
  var activeLevel = 'all';

  function say(message) {
    if (announce) announce.textContent = message;
  }

  /* ---------- theme ---------- */

  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var storedTheme = null;
  try { storedTheme = localStorage.getItem('field-manual-theme'); } catch (e) {}

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    var dark = theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeIcon.textContent = dark ? '◑' : '◐';
    try { localStorage.setItem('field-manual-theme', theme); } catch (e) {}
  }

  var preferred = storedTheme;
  if (!preferred) {
    preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(preferred);

  themeToggle.addEventListener('click', function () {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    say(root.getAttribute('data-theme') === 'dark' ? 'Dark theme on' : 'Light theme on');
  });

  /* ---------- reading progress and back to top ---------- */

  var bar = document.getElementById('progressBar');
  var label = document.getElementById('progressLabel');
  var toTop = document.getElementById('toTop');
  var ticking = false;

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0;
    bar.style.width = pct + '%';
    label.textContent = pct === 0 ? 'Start' : pct + '% read';
    toTop.hidden = window.scrollY < 500;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; }
  }, { passive: true });
  updateProgress();

  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  /* ---------- mobile contents ---------- */

  var contentsToggle = document.getElementById('contentsToggle');
  var sidebar = document.getElementById('sidebar');
  contentsToggle.addEventListener('click', function () {
    var open = sidebar.classList.toggle('is-open');
    contentsToggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('#nav a').forEach(function (link) {
    link.addEventListener('click', function () {
      sidebar.classList.remove('is-open');
      contentsToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- active section ---------- */

  var links = Array.prototype.slice.call(document.querySelectorAll('#nav a'));
  var sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          var on = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', on);
          if (on) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-12% 0px -78% 0px', threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------- search + category filter ---------- */

  function matchesQuery(element, query) {
    if (!query) return true;
    var haystack = ((element.getAttribute('data-search') || '') + ' ' + element.textContent).toLowerCase();
    return query.split(/\s+/).every(function (word) { return haystack.indexOf(word) !== -1; });
  }

  function applyFilters() {
    var query = searchInput.value.trim().toLowerCase();
    var visible = 0;
    var queryActive = query.length > 0;
    var categoryActive = activeCategory !== 'all';
    var levelActive = activeLevel !== 'all';

    allItems.forEach(function (item) {
      var isTemplate = item.classList.contains('template');
      var isTechnique = item.classList.contains('technique');
      var categoryOk = !categoryActive || (isTemplate && item.getAttribute('data-category') === activeCategory);
      var levelOk = !levelActive || (isTechnique && item.getAttribute('data-level') === activeLevel);
      var show = categoryOk && levelOk && matchesQuery(item, query);
      item.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
      if (queryActive && show && item.tagName === 'DETAILS') item.open = true;
    });

    groups.forEach(function (group) {
      var children = Array.prototype.slice.call(group.querySelectorAll('.searchable'));
      if (!children.length) return;
      var any = children.some(function (child) { return !child.classList.contains('is-hidden'); });
      group.classList.toggle('is-hidden', !any && (queryActive || categoryActive));
    });

    if (queryActive || categoryActive || levelActive) {
      searchStatus.textContent = visible === 0 ? 'No matches' : visible + (visible === 1 ? ' match' : ' matches');
    } else {
      searchStatus.textContent = '';
    }
    var levelStatus = document.getElementById('levelStatus');
    if (queryActive || categoryActive) {
      filterStatus.textContent = visible === 0 ? 'Nothing here with those filters.' : visible + ' prompts shown';
    } else {
      filterStatus.textContent = '';
    }
    if (levelActive) {
      levelStatus.textContent = visible === 0 ? 'No techniques at this level.' : visible + ' techniques shown';
    } else {
      levelStatus.textContent = '';
    }
  }

  searchInput.addEventListener('input', applyFilters);
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      searchInput.value = '';
      applyFilters();
      searchInput.blur();
    }
  });

  document.querySelectorAll('.chip[data-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeCategory = chip.getAttribute('data-filter');
      document.querySelectorAll('.chip[data-filter]').forEach(function (other) {
        var on = other === chip;
        other.classList.toggle('is-active', on);
        other.setAttribute('aria-pressed', String(on));
      });
      applyFilters();
      say('Showing ' + chip.textContent + ' prompts');
    });
  });

  document.querySelectorAll('.level-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeLevel = chip.getAttribute('data-level');
      document.querySelectorAll('.level-chip').forEach(function (other) {
        var on = other === chip;
        other.classList.toggle('is-active', on);
        other.setAttribute('aria-pressed', String(on));
      });
      applyFilters();
      say('Showing ' + chip.textContent + ' techniques');
    });
  });

  document.getElementById('randomTip').addEventListener('click', function () {
    var pool = techniques.filter(function (item) { return !item.classList.contains('is-hidden'); });
    if (!pool.length) pool = techniques;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    pick.open = true;
    pick.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    var title = pick.querySelector('.item__title');
    say(title ? title.textContent : 'Technique opened');
  });

  document.getElementById('copyAll').addEventListener('click', function () {
    var visibleTemplates = templates.filter(function (item) { return !item.classList.contains('is-hidden'); });
    var text = visibleTemplates.map(function (item, index) {
      var heading = item.querySelector('.template__head h3');
      var pre = item.querySelector('pre');
      return (index + 1) + '. ' + (heading ? heading.textContent : 'Prompt') + '\n\n' + (pre ? pre.innerText : '');
    }).join('\n\n---\n\n');
    copyText(text, document.getElementById('copyAll'));
  });

  /* ---------- expand / collapse ---------- */

  document.getElementById('expandAll').addEventListener('click', function () {
    details.forEach(function (item) { item.open = true; });
    say('Every section expanded');
  });
  document.getElementById('collapseAll').addEventListener('click', function () {
    details.forEach(function (item) { item.open = false; });
    say('Every section collapsed');
  });

  document.querySelectorAll('details.item > summary').forEach(function (summary) {
    summary.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') return;
      if (event.key.toLowerCase() !== 'n' && event.key.toLowerCase() !== 'p') return;
      var all = Array.prototype.slice.call(document.querySelectorAll('details.item:not(.is-hidden) > summary'));
      var index = all.indexOf(summary);
      var next = event.key.toLowerCase() === 'n' ? index + 1 : index - 1;
      if (next >= 0 && next < all.length) { event.preventDefault(); all[next].focus(); }
    });
  });

  /* ---------- copy buttons ---------- */

  function copyText(text, button) {
    function done() {
      var original = button.getAttribute('data-label') || button.textContent;
      button.setAttribute('data-label', original);
      button.textContent = 'Copied';
      button.classList.add('done');
      say('Prompt copied to clipboard');
      window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove('done');
      }, 1400);
    }
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  document.querySelectorAll('.copy').forEach(function (button) {
    button.addEventListener('click', function () {
      var pre = button.parentElement.querySelector('pre');
      if (pre) copyText(pre.innerText, button);
    });
  });

  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.getElementById(button.getAttribute('data-copy-target'));
      var pre = target && target.querySelector('pre');
      if (pre) copyText(pre.innerText, button);
    });
  });

  /* ---------- checklists ---------- */

  var checks = Array.prototype.slice.call(document.querySelectorAll('.checklist input[type="checkbox"]'));
  var progress = document.getElementById('checkProgress');
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('field-manual-checks') || '{}'); } catch (e) { saved = {}; }

  checks.forEach(function (box, index) {
    var label = box.parentElement.textContent.trim();
    box.checked = !!saved[label];
    box.addEventListener('change', function () {
      saved[label] = box.checked;
      try { localStorage.setItem('field-manual-checks', JSON.stringify(saved)); } catch (e) {}
      updateChecks();
    });
  });

  function updateChecks() {
    var count = checks.filter(function (box) { return box.checked; }).length;
    progress.textContent = count + ' of ' + checks.length + ' checked';
  }
  updateChecks();

  document.getElementById('resetChecks').addEventListener('click', function () {
    checks.forEach(function (box) { box.checked = false; });
    saved = {};
    try { localStorage.setItem('field-manual-checks', '{}'); } catch (e) {}
    updateChecks();
    say('Checklist reset');
  });

  /* ---------- prompt composer ---------- */

  var composerForm = document.getElementById('composerForm');
  var composerOutput = document.getElementById('composerOutput');
  var composerStatus = document.getElementById('composerStatus');
  var composerFields = {
    role: document.getElementById('cRole'),
    goal: document.getElementById('cGoal'),
    context: document.getElementById('cContext'),
    constraints: document.getElementById('cConstraints'),
    check: document.getElementById('cCheck'),
    delivery: document.getElementById('cDelivery')
  };

  function compose() {
    var goal = composerFields.goal.value.trim();
    if (!goal) {
      composerStatus.textContent = 'Add a goal before building the prompt.';
      return null;
    }
    var role = composerFields.role.value.trim() || 'a careful software engineer';
    var useXml = document.getElementById('cXml').checked;
    if (useXml) {
      return [
        '<instructions>',
        'You are ' + role + '.',
        '</instructions>',
        '',
        '<goal>', goal, '</goal>',
        '',
        '<context>', composerFields.context.value.trim() || '(none supplied)', '</context>',
        '',
        '<constraints>', composerFields.constraints.value.trim() || '(none supplied)', '</constraints>',
        '',
        '<success_criteria>', composerFields.check.value.trim() || '(define how success will be verified)', '</success_criteria>',
        '',
        '<delivery>', composerFields.delivery.value.trim(), '</delivery>'
      ].join('\n');
    }
    return [
      'You are ' + role + '.',
      '',
      'Goal: ' + goal,
      'Context: ' + (composerFields.context.value.trim() || '(none supplied)'),
      'Constraints: ' + (composerFields.constraints.value.trim() || '(none supplied)'),
      'Check: ' + (composerFields.check.value.trim() || '(define how success will be verified)'),
      'Delivery: ' + composerFields.delivery.value.trim()
    ].join('\n');
  }

  composerForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var prompt = compose();
    if (!prompt) return;
    composerOutput.textContent = prompt;
    composerStatus.textContent = 'Prompt built. Copy it, or turn it into a metaprompt.';
    say('Prompt composed');
  });

  document.getElementById('composeCopy').addEventListener('click', function () {
    copyText(composerOutput.textContent, this);
  });

  document.getElementById('composeImprove').addEventListener('click', function () {
    var prompt = compose();
    if (!prompt) return;
    composerOutput.textContent = [
      'Score this prompt against this rubric: clarity, completeness of context,',
      'explicit constraints, success criteria, and output format.',
      'Then rewrite it to score higher, explain what you changed,',
      'and return only the revised prompt.',
      '',
      '<prompt>', prompt, '</prompt>'
    ].join('\n');
    composerStatus.textContent = 'Metaprompt built. Paste it into an agent with the prompt still inside the tags.';
    say('Metaprompt built');
  });

  /* ---------- knowledge check ---------- */

  var quizForm = document.getElementById('quizForm');
  var quizResult = document.getElementById('quizResult');
  var answers = { q1: 'b', q2: 'b', q3: 'b', q4: 'b', q5: 'a' };
  var explanations = {
    q1: 'A 200 response and a toast are not proof; read the data back, and look for a second cause.',
    q2: 'A synthetic event skips hit-testing, pointer events and everything that can fail for a person.',
    q3: 'Depth is doing the same job properly. Size is adding more jobs.',
    q4: 'A criterion has a number, a device and a test. “Make it nice” is a wish.',
    q5: 'Metaprompting is using a model to critique and rewrite the prompt itself.'
  };

  quizForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var lines = [];
    var score = 0;
    Object.keys(answers).forEach(function (key) {
      var chosen = quizForm.querySelector('input[name="' + key + '"]:checked');
      if (!chosen) { lines.push(key.toUpperCase() + ': no answer'); return; }
      if (chosen.value === answers[key]) { score += 1; lines.push(key.toUpperCase() + ': correct'); }
      else lines.push(key.toUpperCase() + ': ' + explanations[key]);
    });
    quizResult.hidden = false;
    quizResult.querySelector('p').textContent = score + ' of 5 correct.\n\n' + lines.join('\n');
    say(score + ' of 5 correct');
  });

  document.getElementById('quizReset').addEventListener('click', function () {
    quizForm.reset();
    quizResult.hidden = true;
    say('Quiz reset');
  });

  /* ---------- print ---------- */

  var restore = [];
  window.addEventListener('beforeprint', function () {
    restore = details.map(function (item) { return item.open; });
    details.forEach(function (item) { item.open = true; });
  });
  window.addEventListener('afterprint', function () {
    details.forEach(function (item, index) { item.open = !!restore[index]; });
  });
  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });

  /* ---------- keyboard shortcut ---------- */

  document.addEventListener('keydown', function (event) {
    var tag = (event.target.tagName || '').toLowerCase();
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  applyFilters();
})();
