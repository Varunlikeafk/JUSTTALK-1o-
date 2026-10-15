/* Just Talk landing — mobile & tablet extras. Load AFTER index.js and demo.js. */
(function () {
  'use strict';

  /* 1 — reading progress bar (CSS only shows it <=1024px) */
  var bar = document.createElement('div'); bar.className = 'jt-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var tick = false;
  function prog() {
    tick = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }
  addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(prog); } }, { passive: true });
  prog();

  /* 2 — floating section dock (phones). Appears together with the header, tracks the section on screen. */
  var I = function (p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; };
  var items = [
    ['router',   'Flow',     I('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.5 6h4a3 3 0 0 1 3 3v.5M8.5 18h4a3 3 0 0 0 3-3v-.5"/>')],
    ['features', 'Features', I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>')],
    ['specs',    'Specs',    I('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>')],
    ['faq',      'FAQ',      I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>')]
  ];
  var dock = document.createElement('nav'); dock.className = 'jt-dock'; dock.setAttribute('aria-label', 'Sections');
  dock.innerHTML = items.map(function (i) {
    return '<a href="#' + i[0] + '" data-s="' + i[0] + '">' + i[2] + '<span>' + i[1] + '</span></a>';
  }).join('') + '<a class="go" href="app.html">' + I('<path d="M5 6h14v9H10l-4 3.5V15H5z"/>') + '<span>Chat</span></a>';
  document.body.appendChild(dock);
  dock.addEventListener('click', function () { if (navigator.vibrate) navigator.vibrate(8); });

  var links = {};
  dock.querySelectorAll('[data-s]').forEach(function (a) { links[a.dataset.s] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.remove('on'); });
        links[e.target.id].classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* 3 — the router-network card reacts to fingers, not only the mouse */
  var nc = document.getElementById('netCanvas');
  if (nc) {
    var card = nc.parentElement;
    var touch = function (e) {
      try {
        var r = nc.getBoundingClientRect(), p = e.touches[0];
        netMouse.x = p.clientX - r.left; netMouse.y = p.clientY - r.top;   // netMouse comes from index.js
      } catch (x) {}
    };
    card.addEventListener('touchstart', touch, { passive: true });
    card.addEventListener('touchmove', touch, { passive: true });
    card.addEventListener('touchend', function () { try { netMouse.x = netMouse.y = -9999; } catch (x) {} }, { passive: true });
  }
})();
