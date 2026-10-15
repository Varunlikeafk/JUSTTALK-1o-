/* Regen 1o app — mobile & tablet extras. Load AFTER main.js (end of <body>). */
(function () {
  'use strict';
  var de = document.documentElement, body = document.body, vv = window.visualViewport;
  var sb = document.getElementById('sidebar'), ov = document.getElementById('sidebar-overlay'),
      flow = document.getElementById('chat-flow'), main = document.getElementById('main-container'),
      inp = document.getElementById('input-container');
  var narrow = matchMedia('(max-width:900px)');

  /* 1 — keyboard-aware layout: chat height follows the *visible* viewport, input never hides behind the keyboard */
  function vsize() {
    de.style.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');
    if (vv && vv.offsetTop) scrollTo(0, 0);
    if (inp && main) {
      var b = main.getBoundingClientRect().bottom - inp.getBoundingClientRect().top;
      if (b > 0) de.style.setProperty('--input-h', Math.ceil(b) + 'px');
    }
  }
  vsize();
  if (vv) { vv.addEventListener('resize', function () { vsize(); if (flow && document.activeElement && document.activeElement.id === 'userInput') flow.scrollTop = flow.scrollHeight; }); vv.addEventListener('scroll', vsize); }
  addEventListener('resize', vsize);
  addEventListener('orientationchange', function () { setTimeout(vsize, 250); });
  if (inp && window.ResizeObserver) new ResizeObserver(vsize).observe(inp);

  /* 2 — swipe drawer: drag from the left edge to open, drag the drawer left to close; it follows your finger */
  if (sb && ov) {
    var W = 0, x0 = 0, y0 = 0, t0 = 0, dx = 0, drag = false, lock = 0, startOpen = false;
    var setX = function (px) { sb.style.transform = 'translateX(' + px + 'px)'; ov.style.opacity = Math.max(0, 1 + px / W); };
    document.addEventListener('touchstart', function (e) {
      drag = false; lock = 0;
      if (!narrow.matches || body.dataset.view !== 'view-chat' || e.touches.length > 1) return;
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dx = 0;
      startOpen = sb.classList.contains('open'); W = sb.offsetWidth;
      drag = startOpen ? (sb.contains(e.target) || e.target === ov) : x0 <= 22;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!drag) return;
      var t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
      if (!lock) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        lock = Math.abs(mx) > Math.abs(my) * 1.2 ? 1 : 2;
        if (lock === 1) { sb.style.transition = 'none'; ov.style.transition = 'none'; ov.classList.add('show'); }
      }
      if (lock !== 1) { drag = false; return; }
      dx = mx; setX(Math.min(0, Math.max(-W, (startOpen ? 0 : -W) + dx)));
    }, { passive: true });
    var end = function () {
      if (!drag || lock !== 1) { drag = false; return; }
      drag = false;
      var pos = (startOpen ? 0 : -W) + dx, v = dx / Math.max(1, Date.now() - t0);
      var want = v > .5 ? true : v < -.5 ? false : pos > -W / 2;
      sb.style.transition = ov.style.transition = sb.style.transform = ov.style.opacity = '';
      sb.classList.toggle('open', want); ov.classList.toggle('show', want);
      if (navigator.vibrate) navigator.vibrate(6);
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  }

  /* 3 — "Latest" pill when you've scrolled up in a long chat */
  if (flow && main) {
    var j = document.createElement('button'); j.type = 'button'; j.className = 'jt-jump'; j.setAttribute('aria-label', 'Jump to latest message');
    j.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>Latest';
    main.appendChild(j);
    var chk = function () { j.classList.toggle('show', flow.scrollHeight - flow.scrollTop - flow.clientHeight > 260); };
    flow.addEventListener('scroll', chk, { passive: true });
    new MutationObserver(chk).observe(flow, { childList: true });
    j.addEventListener('click', function () { flow.scrollTo({ top: flow.scrollHeight, behavior: 'smooth' }); });
  }

  /* 4 — one-time edge hint for the swipe drawer */
  var seen = false; try { seen = localStorage.getItem('jt-edge-seen'); } catch (x) {}
  if (!seen) {
    var g = document.createElement('i'); g.className = 'jt-edge'; g.setAttribute('aria-hidden', 'true'); body.appendChild(g);
    g.addEventListener('animationend', function () { g.remove(); try { localStorage.setItem('jt-edge-seen', '1'); } catch (x) {} });
  }
})();
