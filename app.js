(function () {
  'use strict';

  /*
   * The Agent's Field Manual — interactions.
   *
   * Every feature is initialised independently. A missing hook, a blocked
   * localStorage or an unsupported API degrades only that one feature.
   */

  var root = document.documentElement;

  /* ---------- small helpers ---------- */

  function byId(id) { return document.getElementById(id); }

  function all(selector, context) {
    var scope = context || document;
    if (!scope.querySelectorAll) return [];
    return Array.prototype.slice.call(scope.querySelectorAll(selector));
  }

  function on(node, type, handler, options) {
    if (node && node.addEventListener) node.addEventListener(type, handler, options);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function safe(name, fn) {
    try { fn(); }
    catch (error) {
      if (window.console && console.warn) {
        console.warn('Field manual: "' + name + '" could not start.', error);
      }
    }
  }

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }

  function scrollTo(node) {
    if (!node || !node.scrollIntoView) return;
    node.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  var announceNode = byId('announce');
  function say(message) {
    if (!announceNode) return;
    // Repeating an identical string is not announced by some screen readers.
    // Toggle a zero-width space so repeated messages are still spoken,
    // without letting the node grow on every call.
    var current = announceNode.textContent;
    if (current === message) announceNode.textContent = message + '\u200b';
    else if (current === message + '\u200b') announceNode.textContent = message;
    else announceNode.textContent = message;
  }

  /* ---------- shared filter state ---------- */

  var searchInput = byId('siteSearch');
  var searchStatus = byId('searchStatus');
  var filterStatus = byId('filterStatus');
  var levelStatus = byId('levelStatus');

  var allItems = all('.searchable');
  var templates = all('.template');
  var groups = all('.group');
  var details = all('details.item');
  var techniques = all('.technique');

  var activeCategory = 'all';
  var activeLevel = 'all';
  var autoOpened = [];
  var statusTimer = null;
  var printing = false;

  function matchesQuery(element, query) {
    if (!query) return true;
    var haystack = ((element.getAttribute('data-search') || '') + ' ' + element.textContent).toLowerCase();
    return query.split(/\s+/).every(function (word) { return haystack.indexOf(word) !== -1; });
  }

  function setChips(selector, value) {
    all(selector).forEach(function (chip) {
      var on = chip.getAttribute(selector.indexOf('level') !== -1 ? 'data-level' : 'data-filter') === value;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }

  /* ---------- empty-state notice (built at runtime) ---------- */

  var notice = null;
  var noticeText = null;
  var noticeClear = null;

  function buildNotice() {
    if (notice) return;
    var main = byId('main');
    if (!main) return;

    notice = el('div', 'filter-notice');
    notice.id = 'filterNotice';
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    noticeText = el('p', 'filter-notice__msg');
    noticeClear = el('button', 'filter-notice__clear', 'Clear filters and show everything');
    noticeClear.type = 'button';

    notice.appendChild(noticeText);
    notice.appendChild(noticeClear);

    var overview = byId('overview');
    main.insertBefore(notice, overview || main.firstChild);
    on(noticeClear, 'click', clearFilters);
  }

  function clearFilters() {
    if (searchInput) searchInput.value = '';
    activeCategory = 'all';
    activeLevel = 'all';
    setChips('.chip[data-filter]', 'all');
    setChips('.level-chip', 'all');
    applyFilters();
    if (searchInput) searchInput.focus();
    say('Filters cleared. Showing the whole manual.');
  }

  function renderStatus(info) {
    setText(searchStatus, info.searchText);
    setText(filterStatus, info.catText);
    setText(levelStatus, info.lvlText);

    buildNotice();
    if (!notice) return;
    if (info.visible === 0 && info.anyFilter) {
      setText(noticeText, info.emptyText);
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }
  }

  function applyFilters() {
    if (printing) return;

    // Details opened because of a search are closed again when search is cleared.
    if (!searchInput || !searchInput.value.trim()) {
      autoOpened.forEach(function (item) { item.open = false; });
      autoOpened = [];
    }

    var rawQuery = searchInput ? searchInput.value.trim() : '';
    var query = rawQuery.toLowerCase();
    var queryActive = query.length > 0;
    var categoryActive = activeCategory !== 'all';
    var levelActive = activeLevel !== 'all';
    var visible = 0;

    allItems.forEach(function (item) {
      var isTemplate = item.classList.contains('template');
      var isTechnique = item.classList.contains('technique');
      var categoryOk = !categoryActive || (isTemplate && item.getAttribute('data-category') === activeCategory);
      var levelOk = !levelActive || (isTechnique && item.getAttribute('data-level') === activeLevel);
      var show = categoryOk && levelOk && matchesQuery(item, query);

      item.classList.toggle('is-hidden', !show);
      if (show) visible += 1;

      if (queryActive && show && item.tagName === 'DETAILS' && !item.open) {
        item.open = true;
        autoOpened.push(item);
      }
    });

    groups.forEach(function (group) {
      var children = all('.searchable', group);
      if (!children.length) return;
      var any = children.some(function (child) { return !child.classList.contains('is-hidden'); });
      group.classList.toggle('is-hidden', !any && (queryActive || categoryActive || levelActive));
    });

    var info = {
      visible: visible,
      anyFilter: queryActive || categoryActive || levelActive,
      searchText: '',
      catText: '',
      lvlText: '',
      emptyText: ''
    };

    if (queryActive) {
      info.searchText = visible === 0
        ? 'No matches for “' + rawQuery + '”'
        : visible + (visible === 1 ? ' match' : ' matches') + ' for “' + rawQuery + '”';
    }
    if (categoryActive) {
      info.catText = visible === 0
        ? 'No ' + activeCategory + ' prompts'
        : visible + ' ' + activeCategory + ' prompt' + (visible === 1 ? '' : 's');
    }
    if (levelActive) {
      info.lvlText = visible === 0
        ? 'No ' + activeLevel + ' techniques'
        : visible + ' ' + activeLevel + ' technique' + (visible === 1 ? '' : 's');
    }
    if (info.anyFilter && visible === 0) {
      var parts = [];
      if (queryActive) parts.push('“' + rawQuery + '”');
      if (categoryActive) parts.push(activeCategory + ' category');
      if (levelActive) parts.push(activeLevel + ' level');
      info.emptyText = 'Nothing matches ' + parts.join(' + ') +
        '. Try a different word, or use the button below to start again.';
    }

    // Filtering is instant; only the announcements are debounced so typing
    // does not produce one screen-reader message per keystroke.
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () { renderStatus(info); }, 220);
  }

  function jumpToFirstResult() {
    var shown = allItems.filter(function (item) { return !item.classList.contains('is-hidden'); });
    if (shown.length) {
      var first = shown[0];
      var target = first.tagName === 'DETAILS' ? first.querySelector('summary') : first;
      scrollTo(first);
      if (target && target.focus) target.focus({ preventScroll: true });
      return;
    }
    buildNotice();
    if (notice && noticeClear) {
      notice.hidden = false;
      scrollTo(notice);
      noticeClear.focus({ preventScroll: true });
    }
  }

  /* ---------- copy helper ---------- */

  function selectPreText(button) {
    var container = button.closest ? button.closest('.code') : button.parentElement;
    var pre = container && container.querySelector ? container.querySelector('pre') : null;
    if (!pre || !window.getSelection) return;
    var range = document.createRange();
    range.selectNodeContents(pre);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function copyText(text, button) {
    if (!button) { say('Nothing to copy.'); return; }
    if (!text || !text.trim()) { say('There is no text to copy yet.'); return; }

    var originalText = button.getAttribute('data-label') || button.textContent;
    var originalLabel = button.getAttribute('aria-label');
    button.setAttribute('data-label', originalText);

    if (button._copyTimer) window.clearTimeout(button._copyTimer);

    function finish(ok) {
      button.textContent = ok ? 'Copied' : 'Copy failed';
      if (originalLabel) {
        button.setAttribute('aria-label', ok ? 'Copied' : 'Copy failed — text selected for manual copying');
      }
      button.classList.toggle('done', ok);
      button.classList.toggle('copy-error', !ok);
      say(ok ? 'Copied to clipboard' : 'Copy failed. The text is selected so you can copy it manually.');
      button._copyTimer = window.setTimeout(function () {
        button.textContent = originalText;
        if (originalLabel) button.setAttribute('aria-label', originalLabel);
        button.classList.remove('done', 'copy-error');
      }, 1600);
    }

    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '0';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
      document.body.removeChild(area);
      finish(ok);
      if (!ok) selectPreText(button);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { finish(true); }, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- mobile contents panel ---------- */

  var contentsToggle = byId('contentsToggle');
  var sidebar = byId('sidebar');
  var mobileNav = window.matchMedia ? window.matchMedia('(max-width: 980px)') : null;

  function isMobileNav() {
    if (mobileNav && mobileNav.matches) return true;
    if (!contentsToggle || !window.getComputedStyle) return false;
    try { return window.getComputedStyle(contentsToggle).display !== 'none'; }
    catch (error) { return false; }
  }

  function setContents(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (contentsToggle) contentsToggle.setAttribute('aria-expanded', String(open));
  }

  function openContents(focusInside) {
    setContents(true);
    if (!focusInside) return;
    var target = byId('siteSearch') || (sidebar && sidebar.querySelector('a'));
    if (target && target.focus) target.focus();
  }

  function closeContents(returnFocus) {
    setContents(false);
    if (returnFocus && contentsToggle && contentsToggle.focus) contentsToggle.focus();
  }

  /* ---------- feature initialisers ---------- */

  safe('theme', function () {
    var toggle = byId('themeToggle');
    var icon = byId('themeIcon');
    var stored = null;
    try { stored = localStorage.getItem('field-manual-theme'); } catch (error) {}

    function apply(theme) {
      root.setAttribute('data-theme', theme);
      var dark = theme === 'dark';
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(dark));
        toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      }
      if (icon) icon.textContent = dark ? '◑' : '◐';
      try { localStorage.setItem('field-manual-theme', theme); } catch (error) {}
    }

    var preferred = stored;
    if (!preferred) {
      preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    apply(preferred === 'dark' ? 'dark' : 'light');

    on(toggle, 'click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      say(next === 'dark' ? 'Dark theme on' : 'Light theme on');
    });
  });

  safe('reading progress', function () {
    var bar = byId('progressBar');
    var label = byId('progressLabel');
    var toTop = byId('toTop');
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0;
      if (bar) bar.style.width = pct + '%';
      if (label) label.textContent = pct === 0 ? 'Start' : pct + '% read';
      if (toTop) toTop.hidden = window.scrollY < 500;
      ticking = false;
    }

    on(window, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(update);
      else update();
    }, { passive: true });

    update();
    on(toTop, 'click', function () {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  });

  safe('contents panel', function () {
    if (!sidebar) return;

    on(contentsToggle, 'click', function () {
      if (sidebar.classList.contains('is-open')) closeContents(true);
      else openContents(true);
    });

    all('#nav a').forEach(function (link) {
      on(link, 'click', function () { closeContents(false); });
    });

    on(document, 'click', function (event) {
      if (!sidebar.classList.contains('is-open')) return;
      if (contentsToggle && contentsToggle.contains(event.target)) return;
      if (sidebar.contains(event.target)) return;
      closeContents(false);
    });

    if (mobileNav && mobileNav.addEventListener) {
      mobileNav.addEventListener('change', function (event) {
        if (!event.matches) closeContents(false);
      });
    }
  });

  safe('active section', function () {
    var links = all('#nav a');
    if (!links.length) return;

    function setActive(id) {
      links.forEach(function (link) {
        var on = link.getAttribute('href') === '#' + id;
        link.classList.toggle('active', on);
        if (on) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    var sections = links.map(function (link) {
      var href = link.getAttribute('href');
      return href && href.charAt(0) === '#' ? byId(href.slice(1)) : null;
    }).filter(Boolean);

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-12% 0px -78% 0px', threshold: 0 });
      sections.forEach(function (section) { observer.observe(section); });
    } else {
      var ticking = false;
      on(window, 'scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var y = window.scrollY + 120;
          var current = null;
          sections.forEach(function (section) {
            if (section.offsetTop <= y) current = section;
          });
          if (current) setActive(current.id);
          ticking = false;
        });
      }, { passive: true });
    }
  });

  safe('search and filters', function () {
    if (searchInput) {
      searchInput.setAttribute('placeholder', 'Search habits, techniques, prompts…');
      on(searchInput, 'input', applyFilters);
      on(searchInput, 'keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          jumpToFirstResult();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          clearFilters();
        }
      });
    }

    all('.chip[data-filter]').forEach(function (chip) {
      on(chip, 'click', function () {
        activeCategory = chip.getAttribute('data-filter');
        setChips('.chip[data-filter]', activeCategory);
        applyFilters();
      });
    });

    all('.level-chip').forEach(function (chip) {
      on(chip, 'click', function () {
        activeLevel = chip.getAttribute('data-level');
        setChips('.level-chip', activeLevel);
        applyFilters();
      });
    });
  });

  safe('random technique', function () {
    var button = byId('randomTip');
    if (!button || !techniques.length) return;
    on(button, 'click', function () {
      var pool = techniques.filter(function (item) { return !item.classList.contains('is-hidden'); });
      if (!pool.length) pool = techniques.slice();
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return;
      pick.open = true;
      scrollTo(pick);
      var summary = pick.querySelector('summary');
      if (summary && summary.focus) summary.focus({ preventScroll: true });
      var title = pick.querySelector('.item__title');
      say(title ? 'Opened: ' + title.textContent : 'Technique opened');
    });
  });

  safe('copy all', function () {
    var button = byId('copyAll');
    if (!button) return;
    on(button, 'click', function () {
      var shown = templates.filter(function (item) { return !item.classList.contains('is-hidden'); });
      if (!shown.length) {
        say('No prompts are visible. Clear the filters first.');
        return;
      }
      var text = shown.map(function (item, index) {
        var heading = item.querySelector('.template__head h3');
        var pre = item.querySelector('pre');
        return (index + 1) + '. ' + (heading ? heading.textContent : 'Prompt') +
          '\n\n' + (pre ? (pre.innerText || pre.textContent) : '');
      }).join('\n\n---\n\n');
      copyText(text, button);
    });
  });

  safe('expand and collapse', function () {
    on(byId('expandAll'), 'click', function () {
      details.forEach(function (item) { item.open = true; });
      say('Every section expanded');
    });
    on(byId('collapseAll'), 'click', function () {
      details.forEach(function (item) { item.open = false; });
      say('Every section collapsed');
    });
  });

  safe('accordion keys', function () {
    all('details.item > summary').forEach(function (summary) {
      on(summary, 'keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') return;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        var key = String(event.key || '').toLowerCase();
        if (key !== 'n' && key !== 'p') return;
        var list = all('details.item:not(.is-hidden) > summary');
        var index = list.indexOf(summary);
        if (index < 0) return;
        var next = key === 'n' ? index + 1 : index - 1;
        if (next >= 0 && next < list.length) {
          event.preventDefault();
          list[next].focus();
        }
      });
    });
  });

  safe('copy buttons', function () {
    all('.copy').forEach(function (button) {
      on(button, 'click', function () {
        var container = button.closest ? button.closest('.code') : button.parentElement;
        var pre = container && container.querySelector ? container.querySelector('pre') : null;
        if (pre) copyText(pre.innerText || pre.textContent, button);
      });
    });

    all('[data-copy-target]').forEach(function (button) {
      on(button, 'click', function () {
        var target = byId(button.getAttribute('data-copy-target'));
        var pre = target && target.querySelector ? target.querySelector('pre') : null;
        if (pre) copyText(pre.innerText || pre.textContent, button);
      });
    });
  });

  safe('checklists', function () {
    var checks = all('.checklist input[type="checkbox"]');
    var progress = byId('checkProgress');
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('field-manual-checks') || '{}') || {}; }
    catch (error) { saved = {}; }

    checks.forEach(function (box) {
      var label = box.parentElement ? box.parentElement.textContent.trim() : '';
      if (label && Object.prototype.hasOwnProperty.call(saved, label)) box.checked = !!saved[label];
      on(box, 'change', function () {
        if (label) saved[label] = box.checked;
        try { localStorage.setItem('field-manual-checks', JSON.stringify(saved)); } catch (error) {}
        update();
      });
    });

    function update() {
      if (!progress) return;
      var count = checks.filter(function (box) { return box.checked; }).length;
      progress.textContent = count === checks.length && count > 0
        ? 'All ' + count + ' checked — complete.'
        : count + ' of ' + checks.length + ' checked';
    }

    update();

    on(byId('resetChecks'), 'click', function () {
      checks.forEach(function (box) { box.checked = false; });
      saved = {};
      try { localStorage.setItem('field-manual-checks', '{}'); } catch (error) {}
      if (progress) progress.textContent = 'Checklist reset — 0 of ' + checks.length + ' checked';
      say('Checklist reset');
    });
  });

  safe('prompt composer', function () {
    var form = byId('composerForm');
    var output = byId('composerOutput');
    var status = byId('composerStatus');
    var xml = byId('cXml');
    if (!form || !output) return;

    var fields = {
      role: byId('cRole'),
      goal: byId('cGoal'),
      context: byId('cContext'),
      constraints: byId('cConstraints'),
      check: byId('cCheck'),
      delivery: byId('cDelivery')
    };
    var hasPrompt = false;

    if (fields.goal) fields.goal.setAttribute('aria-required', 'true');
    setText(output, 'Your prompt will appear here after you press Build prompt. Fill in Goal at minimum.');

    function setStatus(message, isError) {
      if (!status) return;
      status.textContent = message;
      if (status.classList) status.classList.toggle('is-error', !!isError);
    }

    function clearError() {
      if (!fields.goal) return;
      fields.goal.removeAttribute('aria-invalid');
      if (fields.goal.classList) fields.goal.classList.remove('is-invalid');
    }

    function validateGoal() {
      if (fields.goal && fields.goal.value.trim()) {
        clearError();
        return true;
      }
      if (fields.goal) {
        fields.goal.setAttribute('aria-invalid', 'true');
        if (fields.goal.classList) fields.goal.classList.add('is-invalid');
        fields.goal.focus();
      }
      setStatus('Add a Goal before building the prompt — it is the one required field.', true);
      return false;
    }

    function value(field, fallback) {
      var text = field && field.value ? field.value.trim() : '';
      return text || fallback;
    }

    function compose() {
      if (!fields.goal || !fields.goal.value.trim()) return null;
      var role = value(fields.role, 'a careful software engineer');
      var goal = fields.goal.value.trim();
      var context = value(fields.context, '(none supplied)');
      var constraints = value(fields.constraints, '(none supplied)');
      var check = value(fields.check, '(define how success will be verified)');
      var delivery = value(fields.delivery, '(state how you want it delivered)');

      if (xml && xml.checked) {
        return [
          '<instructions>', 'You are ' + role + '.', '</instructions>', '',
          '<goal>', goal, '</goal>', '',
          '<context>', context, '</context>', '',
          '<constraints>', constraints, '</constraints>', '',
          '<success_criteria>', check, '</success_criteria>', '',
          '<delivery>', delivery, '</delivery>'
        ].join('\n');
      }
      return [
        'You are ' + role + '.', '',
        'Goal: ' + goal,
        'Context: ' + context,
        'Constraints: ' + constraints,
        'Check: ' + check,
        'Delivery: ' + delivery
      ].join('\n');
    }

    on(form, 'submit', function (event) {
      event.preventDefault();
      if (!validateGoal()) return;
      var prompt = compose();
      if (!prompt) return;
      output.textContent = prompt;
      hasPrompt = true;
      setStatus(fields.check && fields.check.value.trim()
        ? 'Prompt built. Copy it, or turn it into a metaprompt.'
        : 'Prompt built. Tip: add a Check so the agent knows how to prove the result.');
    });

    on(fields.goal, 'input', function () {
      if (fields.goal.value.trim()) {
        clearError();
        if (status && status.textContent && status.classList && status.classList.contains('is-error')) {
          setStatus('');
        }
      }
    });

    on(byId('composeCopy'), 'click', function () {
      if (!hasPrompt) {
        setStatus('Build a prompt first, then copy it.', true);
        if (fields.goal) fields.goal.focus();
        return;
      }
      copyText(output.textContent, this);
    });

    on(byId('composeImprove'), 'click', function () {
      if (!validateGoal()) return;
      var prompt = compose();
      if (!prompt) return;
      output.textContent = [
        'Score this prompt against this rubric: clarity, completeness of context,',
        'explicit constraints, success criteria, and output format.',
        'Then rewrite it to score higher, explain what you changed,',
        'and return only the revised prompt.',
        '',
        '<prompt>', prompt, '</prompt>'
      ].join('\n');
      hasPrompt = true;
      setStatus('Metaprompt built. Paste it into an agent with the prompt still inside the tags.');
    });
  });

  safe('prompt clinic', function () {
    var form = byId('clinicForm');
    var input = byId('clinicInput');
    var output = byId('clinicOutput');
    var status = byId('clinicStatus');
    if (!form || !input || !output) return;

    var checks = [
      {
        slot: 'Goal',
        test: /build|create|add|fix|change|make|design|review|write|update|implement/i,
        fix: 'Start with one verb and one finished thing: "Build a content screen with add, edit and delete."'
      },
      {
        slot: 'Context',
        test: /data|file|api|source|where|existing|field|schema|directory|page|table/i,
        fix: 'Say where the data lives and what already exists: "It reads from the same API as the public page."'
      },
      {
        slot: 'Constraints',
        test: /don't|do not|no |not |never|keep|only|without|avoid|must not/i,
        fix: 'Name one thing that must not change: "Do not touch the public pages or the design tokens."'
      },
      {
        slot: 'Check',
        test: /verif|test|check|click|reload|assert|confirm|proof|measure|result/i,
        fix: 'Describe the test and the result to report: "Verify add, reload and a 390px viewport; report what happened."'
      },
      {
        slot: 'Delivery',
        test: /show|local|deploy|commit|preview|wait|approval|approve/i,
        fix: 'Say what to hand back: "Show me locally first. Do not deploy."'
      }
    ];

    function diagnose(text) {
      var findings = checks.map(function (check) {
        return { slot: check.slot, ok: check.test.test(text), fix: check.fix };
      });
      var score = findings.filter(function (finding) { return finding.ok; }).length;
      var verdict = score === 5
        ? 'All five slots are present. Tighten the wording, then send it.'
        : score >= 3
          ? 'A good start. ' + (5 - score) + ' slot' + (5 - score === 1 ? '' : 's') + ' need work.'
          : 'The agent will have to guess most of this. Add the missing slots first.';

      var lines = [score + ' of 5 slots present.', '', verdict, ''];
      findings.forEach(function (finding, index) {
        lines.push((index + 1) + '. ' + finding.slot + ': ' + (finding.ok ? 'present' : 'MISSING'));
        if (!finding.ok) lines.push('   Fix: ' + finding.fix);
      });
      lines.push('', 'Rebuilt shape:', '');
      lines.push('Goal: <the one finished thing>');
      lines.push('Context: <where the data lives and what exists>');
      lines.push('Constraints: <what must not change>');
      lines.push('Check: <what to test and what to report>');
      lines.push('Delivery: show me locally first; do not deploy');
      return lines.join('\n');
    }

    on(form, 'submit', function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (text.length < 8) {
        setText(status, 'Paste a prompt of at least a few words first.');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      output.textContent = diagnose(text);
      setText(status, 'Diagnosis ready. Copy it or revise your prompt and run it again.');
      say('Prompt diagnosed');
    });

    on(byId('clinicClear'), 'click', function () {
      input.value = '';
      input.removeAttribute('aria-invalid');
      output.textContent = 'Paste a prompt above to see its diagnosis.';
      setText(status, '');
      input.focus();
    });
  });

  safe('knowledge check', function () {
    var form = byId('quizForm');
    var result = byId('quizResult');
    if (!form || !result) return;

    var answers = { q1: 'b', q2: 'b', q3: 'b', q4: 'b', q5: 'a' };
    var correctAnswer = {
      q1: 'Proof the write persisted, and a search for a second cause',
      q2: 'Synthetic clicks skip hit-testing and pointer events',
      q3: 'Raise the quality of the same task',
      q4: 'Every action reachable at 390px and saves confirmed by read-back',
      q5: 'Asking a model to critique and rewrite your prompt'
    };
    var explanations = {
      q1: 'A 200 response and a toast are not proof; read the data back, and look for a second cause.',
      q2: 'A synthetic event skips hit-testing, pointer events and everything that can fail for a person.',
      q3: 'Depth is doing the same job properly. Size is adding more jobs.',
      q4: 'A criterion has a number, a device and a test. “Make it nice” is a wish.',
      q5: 'Metaprompting is using a model to critique and rewrite the prompt itself.'
    };
    var further = {
      q1: { href: '#db-proof', text: 'Prove it works' },
      q2: { href: '#quality', text: 'Ask for evidence' },
      q3: { href: '#plan', text: 'Plan before you build' },
      q4: { href: '#db-design', text: 'Design for use' },
      q5: { href: '#composer', text: 'Prompt composer' }
    };

    function emptyResult() {
      while (result.firstChild) result.removeChild(result.firstChild);
      result.appendChild(el('p'));
    }

    function grade() {
      var keys = Object.keys(answers);
      var score = 0;
      var skipped = 0;
      var rows = keys.map(function (key) {
        var chosen = form.querySelector('input[name="' + key + '"]:checked');
        var correct = !!chosen && chosen.value === answers[key];
        if (correct) score += 1;
        else if (!chosen) skipped += 1;
        return { key: key, chosen: chosen, correct: correct };
      });

      var advice = score === 5
        ? 'All five correct — the core ideas have stuck. Try the beginner checklist next.'
        : score >= 3
          ? 'Good foundation. Read the notes below, then rebuild a prompt with the composer.'
          : 'Read the notes below — each one points to the section that explains it.';
      if (skipped) advice += ' ' + skipped + ' question' + (skipped === 1 ? '' : 's') + ' left blank.';

      emptyResult();
      var head = el('p', 'quiz-result__score', score + ' of 5 correct. ' + advice);
      result.appendChild(head);

      var list = el('ol', 'quiz-result__list');
      rows.forEach(function (row, index) {
        var item = el('li', 'quiz-result__item ' +
          (row.correct ? 'is-correct' : (row.chosen ? 'is-wrong' : 'is-skipped')));

        item.appendChild(el('p', 'quiz-result__verdict',
          row.correct ? '✓ Correct' : (row.chosen ? '✕ Not quite' : '○ No answer')));
        item.appendChild(el('p', 'quiz-result__answer', 'Answer: ' + correctAnswer[row.key]));
        item.appendChild(el('p', 'quiz-result__why', explanations[row.key]));

        var link = el('a', 'quiz-result__goto', 'Review: ' + further[row.key].text);
        link.href = further[row.key].href;
        item.appendChild(link);

        if (!row.chosen) {
          var retry = el('button', 'quiz-result__goto', 'Go to question ' + (index + 1));
          retry.type = 'button';
          on(retry, 'click', function () {
            var first = form.querySelector('input[name="' + row.key + '"]');
            if (!first) return;
            first.focus();
            scrollTo(first);
          });
          item.appendChild(retry);
        }
        list.appendChild(item);
      });
      result.appendChild(list);
      result.hidden = false;
      // The result region is itself a polite live region; no second announce.
    }

    on(form, 'submit', function (event) {
      event.preventDefault();
      grade();
    });

    on(byId('quizReset'), 'click', function () {
      form.reset();
      emptyResult();
      result.hidden = true;
      say('Quiz reset. Choose an answer to try again.');
      var first = form.querySelector('input[type="radio"]');
      if (first && first.focus) first.focus();
    });
  });

  safe('printing', function () {
    var savedOpen = null;
    var savedHidden = null;

    on(window, 'beforeprint', function () {
      printing = true;
      savedOpen = details.map(function (item) { return item.open; });
      savedHidden = allItems.concat(groups).map(function (item) {
        return item.classList.contains('is-hidden');
      });
      details.forEach(function (item) { item.open = true; });
      allItems.concat(groups).forEach(function (item) { item.classList.remove('is-hidden'); });
    });

    on(window, 'afterprint', function () {
      printing = false;
      if (savedOpen) {
        details.forEach(function (item, index) { item.open = !!savedOpen[index]; });
      }
      if (savedHidden) {
        allItems.concat(groups).forEach(function (item, index) {
          item.classList.toggle('is-hidden', !!savedHidden[index]);
        });
      }
      savedOpen = null;
      savedHidden = null;
    });

    on(byId('printBtn'), 'click', function () { window.print(); });
  });

  safe('keyboard shortcuts', function () {
    on(document, 'keydown', function (event) {
      if (event.key === 'Escape') {
        // The search field handles its own Escape (clear filters).
        if (searchInput && event.target === searchInput) return;
        if (sidebar && sidebar.classList.contains('is-open')) closeContents(true);
        return;
      }

      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      var tag = String(event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
      if (!searchInput) return;

      event.preventDefault();
      if (isMobileNav()) openContents(false);
      searchInput.focus();
      searchInput.select();
    });
  });

  safe('first-visit guidance', function () {
    var cover = document.querySelector('.cover');
    if (!cover) return;
    var seen = false;
    try { seen = localStorage.getItem('field-manual-onboarded') === '1'; } catch (error) {}
    if (seen) return;

    var card = el('section', 'start-here');
    card.id = 'startHere';
    var title = el('h2', '', 'New here? Start here');
    title.id = 'startHereTitle';
    card.setAttribute('aria-labelledby', title.id);
    card.appendChild(title);
    card.appendChild(el('p', 'start-here__lede', 'Three steps to get the most from this guide.'));

    var steps = [
      {
        lead: 'Copy the five-slot prompt.',
        rest: ' The template under the title is the fastest way in — replace the angle brackets.'
      },
      {
        lead: 'Open a numbered row.',
        rest: ' Habits, rules, techniques and stories all expand. Use “Expand every section” to skim.'
      },
      {
        lead: 'Practise in the lab.',
        rest: ' The composer builds a structured prompt and the quiz explains every answer.'
      }
    ];
    var list = el('ol', 'start-here__steps');
    steps.forEach(function (step) {
      var li = el('li');
      li.appendChild(el('strong', '', step.lead));
      li.appendChild(document.createTextNode(step.rest));
      list.appendChild(li);
    });
    card.appendChild(list);

    var keys = el('p', 'start-here__keys', 'Shortcuts: ');
    function kbd(text) { var node = el('kbd', '', text); return node; }
    keys.appendChild(kbd('/'));
    keys.appendChild(document.createTextNode(' search · '));
    keys.appendChild(kbd('n'));
    keys.appendChild(document.createTextNode(' / '));
    keys.appendChild(kbd('p'));
    keys.appendChild(document.createTextNode(' next / previous · '));
    keys.appendChild(kbd('Esc'));
    keys.appendChild(document.createTextNode(' clear search'));
    card.appendChild(keys);

    var dismiss = el('button', 'start-here__dismiss', 'Got it');
    dismiss.type = 'button';
    on(dismiss, 'click', function () {
      try { localStorage.setItem('field-manual-onboarded', '1'); } catch (error) {}
      card.hidden = true;
      say('Tip dismissed. Press the forward slash key any time to search.');
    });
    card.appendChild(dismiss);

    cover.parentNode.insertBefore(card, cover.nextSibling);
  });

  applyFilters();
})();
