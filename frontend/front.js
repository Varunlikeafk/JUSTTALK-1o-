/**
 * Glyph Portal (vanilla JS port) — original React component © 2026 Christian Katzmann, MIT.
 * Origin: UsefulPortal.astro on https://ktzm.dk. Keep this notice with copies.
 * A scroll-driven camera through live type. No dependencies.
 *
 * Usage: GlyphPortal(document.getElementById("host"), { word: "REGEN", front: "<html>", content: "<html>" })
 */
(function () {
  "use strict";
  var clamp = function (n, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, n)); };
  var smooth = function (a, b, n) { var t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  var DEFAULT_FONT = '"Arial Black", "Arial", sans-serif';
  var counter = 0;
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* Largest opaque square, in linear time. Works in O, S and Ø. */
  function interior(context, char, font) {
    var canvas = context.canvas;
    context.font = font;
    var m = context.measureText(char);
    var pad = 8;
    var left = Math.ceil(m.actualBoundingBoxLeft);
    var ascent = Math.ceil(m.actualBoundingBoxAscent);
    canvas.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
    canvas.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
    context.font = font;
    context.fontKerning = "none";
    context.fillText(char, pad + left, pad + ascent);
    var width = canvas.width, height = canvas.height;
    var pixels = context.getImageData(0, 0, width, height).data;
    var rows = new Uint16Array(width + 1);
    var size = 0, bx = 0, by = 0;
    for (var y = 0; y < height; y++) {
      var diagonal = 0;
      for (var x = 0; x < width; x++) {
        var above = rows[x + 1];
        rows[x + 1] = pixels[(y * width + x) * 4 + 3] > 245 ? Math.min(above, rows[x], diagonal) + 1 : 0;
        diagonal = above;
        if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; }
      }
    }
    if (size < 3) return null;
    return { x: (bx + 1 - size / 2 - pad - left) / 3, y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
  }

  function scrollParent(element) {
    for (var p = element.parentElement; p; p = p.parentElement) {
      if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY) && p !== document.body && p !== document.documentElement) return p;
    }
    return null;
  }

  window.GlyphPortal = function (host, options) {
    var o = options || {};
    var uid = "gp-" + (++counter);
    var clipId = uid + "-clip";
    var text = (String(o.word || "SUBLIME").trim().normalize("NFC")) || "SUBLIME";
    var focusChar = o.focusChar;
    var interactive = o.interactive !== false;
    var annotations = !!o.annotations;
    var fontFamily = o.fontFamily || DEFAULT_FONT;
    var weight = isFinite(o.fontWeight) ? clamp(o.fontWeight, 1, 1000) : 900;
    var length = isFinite(o.scrollLength) ? clamp(o.scrollLength, 1, 8) : 2.4;
    var enterLabel = o.enterLabel || "Enter section";
    var front = o.front || "";
    var hasFront = !!front;
    var q = ":where(#" + uid + ")";

    var characters = [], off = 0;
    Array.from(text).forEach(function (ch) { characters.push({ char: ch, index: off }); off += ch.length; });

    var section = document.createElement("section");
    section.id = uid;
    section.setAttribute("aria-label", text);
    section.style.setProperty("--gp-length", length);
    section.style.setProperty("--gp-characters", Array.from(text).length);

    var defaultField = '<div data-gp-default-field style="position:absolute;inset:0;transform:scale(var(--gp-field-scale,1));background:radial-gradient(circle at 18% 8%,rgba(16,163,127,.75),transparent 36%),radial-gradient(circle at 82% 20%,rgba(255,255,255,.12),transparent 28%),radial-gradient(circle at 48% 78%,rgba(8,60,48,.55),transparent 44%),linear-gradient(135deg,#0a3a31 0%,#0f6f5a 50%,#072b24 100%)"></div>';

    section.innerHTML =
      "<style>" +
      q + "{--gp-paper:#f7f7f8;--gp-ink:#202123;--gp-field:#0a3a31;--gp-foreground:#ffffff;position:relative;isolation:isolate;background:var(--gp-paper);color:var(--gp-ink);font-family:Arial,sans-serif;}" +
      q + ">[data-gp-viewport]{position:absolute;inset:0 auto auto 0;height:100vh;height:100svh;width:0;pointer-events:none;visibility:hidden;}" +
      q + " [data-gp-pin]{position:relative;height:var(--gp-height,100svh);overflow:clip;isolation:isolate;container-type:size;}" +
      q + " [data-gp-field]{position:absolute;inset:0;background:var(--gp-field);opacity:0;pointer-events:none;}" +
      q + "[data-gp-ready] [data-gp-field]{opacity:1;}" +
      q + " [data-gp-art]{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}" +
      q + " [data-gp-marks]{fill:none;stroke:var(--gp-ink);opacity:.6;}" +
      q + " [data-gp-choices]{position:absolute;inset:0;visibility:hidden;pointer-events:none;}" +
      q + "[data-gp-choosing=true] [data-gp-choices]{visibility:visible;}" +
      q + " [data-gp-letter]{box-sizing:border-box;position:absolute;border:0;padding:0;margin:0;background:transparent;cursor:pointer;pointer-events:auto;touch-action:pan-y;}" +
      q + " [data-gp-letter]:disabled{pointer-events:none;}" +
      q + " [data-gp-letter]:focus-visible{outline:2px solid var(--gp-field);outline-offset:5px;}" +
      q + " [data-gp-touch-picker]{display:none;position:absolute;top:calc(var(--gp-word-bottom,50%) + 42px);left:50%;transform:translateX(-50%);font:12px/1.4 Arial,sans-serif;align-items:center;gap:12px;visibility:hidden;}" +
      q + "[data-gp-choosing=true] [data-gp-touch-picker]{visibility:visible;}" +
      q + " [data-gp-select]{min-height:44px;min-width:90px;border:1px solid #d9d9e3;border-radius:6px;background:var(--gp-paper);color:var(--gp-ink);padding:0 10px;font:inherit;}" +
      q + " [data-gp-select]:focus-visible{outline:2px solid var(--gp-field);outline-offset:4px;}" +
      "@media(any-pointer:coarse){" + q + " [data-gp-touch-picker]{display:flex;}}" +
      q + " [data-gp-fallback]{position:absolute;inset:0;display:none;place-items:center;font-size:min(calc(100cqw / var(--gp-characters)),38cqh);line-height:1;color:var(--gp-field);}" +
      q + "[data-gp-ready] [data-gp-fallback]{visibility:hidden;}" +
      q + " [data-gp-caption]{position:absolute;inset:auto 8% 9%;display:flex;align-items:center;justify-content:space-between;gap:1rem;font:12px/1.4 Arial,sans-serif;opacity:var(--gp-caption,1);pointer-events:var(--gp-caption-hit,auto);}" +
      q + " [data-gp-front]{position:absolute;inset:0;opacity:var(--gp-caption,1);pointer-events:none;}" +
      q + " [data-gp-front] a," + q + " [data-gp-front] button{pointer-events:var(--gp-caption-hit,auto);}" +
      q + " [data-gp-front]:focus-within{opacity:1;}" +
      q + " [data-gp-hint]{max-width:30ch;color:var(--gp-ink);}" +
      q + " [data-gp-enter]{display:inline-flex;align-items:center;gap:16px;min-height:44px;color:inherit;font:inherit;text-decoration:none;letter-spacing:inherit;}" +
      q + " [data-gp-enter]:focus-visible{outline:2px solid currentColor;outline-offset:5px;}" +
      q + " [data-gp-caption]:focus-within{opacity:1;pointer-events:auto;}" +
      q + " [data-gp-content]{box-sizing:border-box;position:relative;min-height:var(--gp-height,100svh);padding:clamp(32px,7%,100px);display:grid;align-content:center;color:var(--gp-foreground);background:var(--gp-field);overflow-wrap:anywhere;}" +
      q + "[data-gp-motion=on] [data-gp-pin]{position:sticky;top:0;}" +
      q + "[data-gp-motion=off] [data-gp-hint]{display:none;}" +
      q + "[data-gp-motion=on] [data-gp-content]{margin-top:calc((var(--gp-length) - 1) * var(--gp-height));background:transparent;opacity:var(--gp-reveal,0);pointer-events:none;}" +
      q + "[data-gp-motion=on][data-gp-entered=true] [data-gp-content]{pointer-events:auto;}" +
      q + "[data-gp-motion=on]:has([data-gp-content]:focus-within) [data-gp-field]{clip-path:none!important;}" +
      q + "[data-gp-motion=on] [data-gp-content]:focus-within{opacity:1;pointer-events:auto;}" +
      q + ":has([data-gp-content]:focus-within) [data-gp-caption]," + q + ":has([data-gp-content]:focus-within) [data-gp-marks]{opacity:0;}" +
      "@media(prefers-reduced-motion:reduce){" + q + " [data-gp-pin]{position:relative!important;} " + q + " [data-gp-content]{margin-top:0!important;opacity:1!important;background:var(--gp-field)!important;min-height:0;padding-block:64px;} " + q + " [data-gp-caption]{opacity:1!important;} " + q + " [data-gp-hint]{display:none;}}" +
      "</style>" +
      '<div data-gp-viewport aria-hidden="true"></div>' +
      "<div data-gp-pin>" +
      '<div data-gp-field aria-hidden="true" inert>' + (o.background || defaultField) + "</div>" +
      '<svg data-gp-art aria-hidden="true" focusable="false"><defs><clipPath id="' + clipId + '" clipPathUnits="userSpaceOnUse"><text data-gp-glyph x="0" y="0">' + esc(text) + '</text></clipPath></defs><g data-gp-marks style="visibility:' + (annotations ? "visible" : "hidden") + '"><path></path></g></svg>' +
      '<div data-gp-choices role="radiogroup" aria-label="Choose the letter to enter through" inert>' +
      characters.map(function (c, i) { return '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-gp-letter="' + c.index + '" aria-label="' + esc(c.char) + ", letter " + (i + 1) + " of " + characters.length + '"></button>'; }).join("") +
      "</div>" +
      '<label data-gp-touch-picker><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Entry letter</span><select data-gp-select><option value="" disabled selected>Choose a letter</option>' +
      characters.map(function (c, i) { return '<option value="' + c.index + '">' + (i + 1) + " · " + esc(c.char) + "</option>"; }).join("") +
      "</select></label>" +
      (hasFront ? "<div data-gp-front>" + front + "</div>" : "") +
      '<span data-gp-fallback aria-hidden="true">' + esc(text) + "</span>" +
      '<div data-gp-caption><span data-gp-hint aria-hidden="true">' + (interactive ? "Scroll to enter." : annotations ? "A passage through type" : "") + '</span><a data-gp-enter href="#' + uid + '-content">' + esc(enterLabel) + '<span aria-hidden="true">↘</span></a></div>' +
      "</div>" +
      '<div data-gp-content id="' + uid + '-content" tabindex="-1">' + (o.content || '<div><h2>A letter becomes a place.</h2><p>The shape opens onto whatever comes next.</p></div>') + "</div>";

    host.appendChild(section);

    var pin = section.querySelector("[data-gp-pin]");
    var field = section.querySelector("[data-gp-field]");
    var art = section.querySelector("[data-gp-art]");
    var clip = section.querySelector("#" + clipId);
    var glyph = section.querySelector("[data-gp-glyph]");
    var marks = section.querySelector("[data-gp-marks]");
    var choices = section.querySelector("[data-gp-choices]");
    var buttons = Array.prototype.slice.call(choices.querySelectorAll("button"));
    var picker = section.querySelector("[data-gp-select]");
    var root = scrollParent(section);
    var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d", { willReadFrequently: true });
    var disposed = false, raf = 0, dirty = true, active = true, ready = false;
    var mountedAt = performance.now();
    var browserFrameSeen = false, stalled = false;
    var W = 1, H = 1, travel = 1, startScale = 1, endScale = 1;
    var center = { x: 0, y: 0 }, target = null;
    var lastProgress = -1;
    var candidates = [], letters = [];
    var choosing = false;
    var bounds = { x: 0, y: 0, width: 1, height: 1 };
    var fontDirty = true;

    glyph.style.cssText = "font-weight:" + weight + ";font-size:100px;font-kerning:none;font-variant-ligatures:none;letter-spacing:0;";
    section.querySelector("[data-gp-fallback]").style.cssText = "font-weight:" + weight + ";";
    // Freeze an available face for this mount.
    glyph.style.fontFamily = fontFamily;
    var computedFamily = getComputedStyle(glyph).fontFamily;
    var families = computedFamily.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) || [];
    var available = families.filter(function (family) {
      try { return document.fonts.check(weight + " 100px " + family.trim(), text); } catch (e) { return false; }
    });
    var frozen = available.concat([DEFAULT_FONT]).join(",");
    glyph.style.fontFamily = frozen;
    section.querySelector("[data-gp-fallback]").style.fontFamily = frozen;
    stalled = available.length < families.length;

    function readInk() {
      if (!context) return false;
      var font = getComputedStyle(glyph);
      var scanFont = font.fontWeight + " 300px " + font.fontFamily;
      context.font = font.fontWeight + " 100px " + font.fontFamily;
      context.fontKerning = "none";
      var metrics = context.measureText(text);
      var advances = [];
      for (var i = 0; i < text.length; i++) advances.push(context.measureText(text.slice(0, i)).width);
      bounds = {
        x: -metrics.actualBoundingBoxLeft, y: -metrics.actualBoundingBoxAscent,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      };
      if (!bounds.width || !bounds.height) return false;
      center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      var requested = focusChar ? text.indexOf(String(focusChar).normalize("NFC")) : -1;
      var offset = 0;
      candidates = []; letters = [];
      Array.from(text).forEach(function (char) {
        context.font = font.fontWeight + " 100px " + font.fontFamily;
        var m = context.measureText(char);
        letters.push({ index: offset, x: advances[offset] - m.actualBoundingBoxLeft, y: -m.actualBoundingBoxAscent,
          width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent });
        var found = interior(context, char, scanFont);
        if (found) candidates.push({ x: found.x + advances[offset], y: found.y, radius: found.radius, index: offset });
        offset += char.length;
      });
      var byIndex = candidates.filter(function (c) { return c.index === requested; })[0];
      target = byIndex || candidates.slice().sort(function (a, b) { return b.radius - a.radius || Math.abs(a.x - center.x) - Math.abs(b.x - center.x); })[0] || null;
      return true;
    }

    function hasCandidate(index) { return candidates.some(function (c) { return c.index === index; }); }

    function select(next) {
      target = next;
      endScale = target ? Math.max(startScale, Math.hypot(W, H) / (target.radius * 1.35)) : startScale;
      section.dataset.gpFocus = target ? Array.from(text.slice(target.index))[0] : "";
      section.dataset.gpFocusIndex = String(target ? target.index : -1);
      buttons.forEach(function (button) {
        var idx = Number(button.dataset.gpLetter);
        var selected = target && idx === target.index;
        button.disabled = !hasCandidate(idx);
        button.setAttribute("aria-checked", String(!!selected));
        button.tabIndex = selected ? 0 : -1;
      });
      if (picker.value !== "") picker.value = String(target ? target.index : -1);
      Array.prototype.forEach.call(picker.options, function (option) { option.disabled = option.value === "" || !hasCandidate(Number(option.value)); });
      var u = 1 / startScale;
      var y = bounds.y + bounds.height + 25 * u;
      var x = bounds.x;
      var right = x + bounds.width;
      var cross = target ? "M" + (target.x - 9 * u) + " " + target.y + "h" + (18 * u) + "M" + target.x + " " + (target.y - 9 * u) + "v" + (18 * u) : "";
      var annotationPath = marks.querySelector("path");
      annotationPath.setAttribute("d", "M" + x + " " + y + "H" + right + "M" + x + " " + (y - 5 * u) + "v" + (10 * u) + "M" + right + " " + (y - 5 * u) + "v" + (10 * u) + cross);
      annotationPath.setAttribute("stroke-width", String(u));
    }

    function position() {
      var origin = root ? root.getBoundingClientRect().top + root.clientTop : 0;
      return clamp((origin - section.getBoundingClientRect().top) / travel);
    }

    function paint(progress) {
      var isStatic = motion.matches || !browserFrameSeen || stalled || !target;
      var p = isStatic ? 0 : progress;
      var t = clamp(p / 0.78);
      var eased = t < 0.5 ? 4 * Math.pow(t, 3) : 1 - Math.pow(-2 * t + 2, 3) / 2;
      var scale = Math.exp(Math.log(startScale) + Math.log(endScale / startScale) * eased);
      var blend = endScale === startScale ? 0 : (1 / scale - 1 / startScale) / (1 / endScale - 1 / startScale);
      var cx = center.x + ((target ? target.x : center.x) - center.x) * blend;
      var cy = center.y + ((target ? target.y : center.y) - center.y) * blend;
      var roll = -4 * smooth(0.06, 0.5, t) * (1 - smooth(0.62, 0.92, t));
      var transform = "translate(" + (W / 2) + " " + (H * 0.46 + H * 0.04 * eased) + ") scale(" + scale + ") rotate(" + roll + ") translate(" + (-cx) + " " + (-cy) + ")";
      var radians = roll * Math.PI / 180;
      var dx = W / 2 / scale, dy = (H * 0.46 + H * 0.04 * eased) / scale;
      clip.setAttribute("transform", "scale(" + scale + ") rotate(" + roll + ")");
      glyph.setAttribute("transform", "translate(" + (Math.cos(radians) * dx + Math.sin(radians) * dy - cx) + " " + (-Math.sin(radians) * dx + Math.cos(radians) * dy - cy) + ")");
      marks.setAttribute("transform", transform);
      marks.style.opacity = String(1 - smooth(0.015, 0.17, p));
      choosing = interactive && !isStatic && p < 0.04;
      choices.inert = !choosing;
      section.dataset.gpChoosing = String(choosing);
      field.style.clipPath = t >= 1 ? "none" : "url(#" + clipId + ")";
      section.style.setProperty("--gp-caption", String(1 - smooth(0.01, 0.16, p)));
      section.style.setProperty("--gp-reveal", String(isStatic ? 1 : smooth(0.78, 0.9, p)));
      section.style.setProperty("--gp-field-scale", String(1 + 0.16 * smooth(0, 0.82, p)));
      section.style.setProperty("--gp-caption-hit", p < 0.08 ? "auto" : "none");
      section.dataset.gpEntered = String(p >= 0.9);
      section.dataset.gpProgress = p.toFixed(5);
      if (p !== lastProgress) { lastProgress = p; if (o.onProgress) o.onProgress(p); }
    }

    function layout() {
      if (!section.clientWidth) return;
      W = pin.clientWidth;
      var smallViewport = section.querySelector("[data-gp-viewport]").offsetHeight;
      var viewportHeight = Math.max(1, Math.min(root ? root.clientHeight : smallViewport, smallViewport));
      H = motion.matches ? Math.min(viewportHeight * 0.75, 480) : viewportHeight;
      section.style.setProperty("--gp-height", H + "px");
      travel = H * length;
      art.setAttribute("viewBox", "0 0 " + W + " " + H);
      if (fontDirty) { ready = readInk(); fontDirty = false; }
      if (!ready) return;
      var wordHeight = hasFront && H < 480 ? Math.min(H * 0.38, Math.max(24, H - 264)) : H * 0.38;
      startScale = Math.min(W * 0.84 / bounds.width, wordHeight / bounds.height);
      select(target);
      buttons.forEach(function (button) {
        var letter = letters.filter(function (item) { return item.index === Number(button.dataset.gpLetter); })[0];
        button.style.left = (W / 2 + (letter.x - center.x) * startScale) + "px";
        button.style.top = (H * 0.46 + (letter.y - center.y) * startScale - Math.max(0, 44 - letter.height * startScale) / 2) + "px";
        button.style.width = Math.max(1, letter.width * startScale) + "px";
        button.style.height = Math.max(44, letter.height * startScale) + "px";
      });
      section.style.setProperty("--gp-word-top", (H * 0.46 - bounds.height * startScale / 2) + "px");
      section.style.setProperty("--gp-word-bottom", (H * 0.46 + bounds.height * startScale / 2) + "px");
      section.dataset.gpReady = "true";
      section.dataset.gpMotion = !motion.matches && browserFrameSeen && !stalled && target ? "on" : "off";
    }

    function frame(time) {
      raf = 0;
      if (disposed) return;
      if (time !== undefined && !browserFrameSeen) {
        browserFrameSeen = true; stalled = stalled || performance.now() - mountedAt > 2500; dirty = true;
      }
      if (dirty) { dirty = false; layout(); }
      if (ready) paint(position());
    }
    function schedule() { if (!raf && active) raf = requestAnimationFrame(frame); }
    function resize() { cancelAnimationFrame(raf); dirty = true; frame(); }
    function scroll() { schedule(); }
    function choose(event) {
      if (!choosing || position() >= 0.04) return;
      var button = event.target.closest && event.target.closest("[data-gp-letter]");
      var idx = button ? Number(button.dataset.gpLetter) : -1;
      var next = candidates.filter(function (c) { return c.index === idx; })[0];
      if (!next || next === target) return;
      select(next); paint(position());
    }
    function navigate(event) {
      if (!choosing || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].indexOf(event.key) < 0) return;
      event.preventDefault();
      var current = candidates.indexOf(target);
      var index = event.key === "Home" ? 0 : event.key === "End" ? candidates.length - 1
        : (current + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + candidates.length) % candidates.length;
      var btn = buttons.filter(function (b) { return Number(b.dataset.gpLetter) === candidates[index].index; })[0];
      if (btn) btn.focus({ preventScroll: true });
    }
    function pick() {
      if (!choosing || position() >= 0.04) return;
      var next = candidates.filter(function (c) { return c.index === Number(picker.value); })[0];
      if (next) { select(next); paint(position()); }
    }
    choices.addEventListener("pointerover", choose);
    choices.addEventListener("click", choose);
    choices.addEventListener("focusin", choose);
    choices.addEventListener("keydown", navigate);
    picker.addEventListener("change", pick);
    var observer = new ResizeObserver(resize);
    observer.observe(section);
    if (root) observer.observe(root);
    var visibility = new IntersectionObserver(function (entries) {
      active = entries[0].isIntersecting;
      if (active) { dirty = true; schedule(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { root: root, rootMargin: "100% 0px" });
    visibility.observe(section);
    (root || window).addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    motion.addEventListener("change", resize);
    frame();
    schedule();

    return {
      destroy: function () {
        disposed = true;
        cancelAnimationFrame(raf);
        observer.disconnect();
        visibility.disconnect();
        (root || window).removeEventListener("scroll", scroll);
        window.removeEventListener("resize", resize);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
        motion.removeEventListener("change", resize);
        section.remove();
      }
    };
  };
})();

GlyphPortal(document.getElementById("regen-portal"), {
  word: "REGEN",
  fontFamily: '"Arial Black", Arial, sans-serif',
  fontWeight: 900,
  scrollLength: 2.4,
  interactive: true,
  enterLabel: "Step inside",
  front:
    '<p style="position:absolute;inset:auto 24px calc(100% - var(--gp-word-top,35%) + 28px);margin:0;text-align:center;font:500 13px/1.5 Inter,Arial,sans-serif;letter-spacing:.02em;color:#6e6e80">Meet the model</p>' +
    '<p style="position:absolute;inset:calc(var(--gp-word-bottom,50%) + 28px) 24px auto;margin:0;text-align:center;font:400 16px/1.5 Inter,Arial,sans-serif;color:#565869">Route. Verify. Reason. Answer.</p>' +
    '<span style="position:absolute;inset:auto 24px 6%;text-align:center;color:#8e8ea0;font:11px Inter,Arial,sans-serif">Scroll for a closer look \u2193</span>',
  content:
    '<style>' +
    '#regen-portal [data-gp-enter]{min-height:46px;padding:0 22px;background:#10a37f;color:#fff;border-radius:10px;font:600 13px Inter,Arial,sans-serif;gap:24px;transition:background .18s}' +
    '#regen-portal [data-gp-enter]:hover{background:#0e8f6f}' +
    '#regen-portal [data-gp-caption]{inset:calc(var(--gp-word-bottom,50%) + 82px) 24px auto;justify-content:center}' +
    '#regen-portal [data-gp-hint]{display:none}' +
    '#regen-portal [data-gp-touch-picker]{top:auto;bottom:18px}' +
    '.rp-copy{display:flex;width:min(100%,72rem);margin:auto;flex-direction:column;align-items:flex-start;gap:clamp(1.5rem,4svh,3rem)}' +
    '.rp-copy h2{max-width:44rem;font:600 clamp(1.75rem,1rem + 2.6vw,2.6rem)/1.2 "Space Grotesk",Arial,sans-serif;letter-spacing:-.02em}' +
    '.rp-feats{display:grid;width:100%;grid-template-columns:1fr;gap:1.5rem}' +
    '.rp-feat{border-top:1px solid rgba(255,255,255,.25);padding-top:1rem}' +
    '.rp-feat h3{font:600 1.1rem "Space Grotesk",Arial,sans-serif}' +
    '.rp-feat p{margin-top:.5rem;color:rgba(255,255,255,.85);font:.95rem/1.55 Inter,Arial,sans-serif}' +
    '.rp-no{margin-right:.7rem;color:rgba(255,255,255,.7);font:500 .75rem ui-monospace,monospace;letter-spacing:.08em}' +
    '.rp-go{display:inline-flex;align-items:center;min-height:46px;padding:0 22px;border-radius:10px;background:#fff;color:#0a3a31;font:600 14px Inter,Arial,sans-serif}' +
    '@media(min-width:768px){.rp-feats{grid-template-columns:repeat(3,minmax(0,1fr));gap:2.5rem}}' +
    '</style>' +
    '<div class="rp-copy"><h2>An AI that shows you how it got there.</h2>' +
    '<div class="rp-feats">' +
    '<div class="rp-feat"><h3><span class="rp-no">01</span>Routes first</h3><p>Every message is sorted into the right path before the model answers.</p></div>' +
    '<div class="rp-feat"><h3><span class="rp-no">02</span>Verifies on the web</h3><p>Facts are checked against live search results, with the source attached.</p></div>' +
    '<div class="rp-feat"><h3><span class="rp-no">03</span>Shows its reasoning</h3><p>Open the thought process on any reply and see exactly what happened.</p></div>' +
    '</div><a class="rp-go" href="index.html">Start chatting \u2192</a></div>'
});

// ---------------------------------------------------------------------
// Live hero terminal — talks to the real Regen 1 Alpha backend.
// Change API_URL if you deploy the backend somewhere else.
// ---------------------------------------------------------------------
const API_URL = "https://justtalk-1-1-alpha-1.onrender.com/chat";
let termHistory = [];
let msgCount = 0;

const termBody = document.getElementById("termBody");
const termInput = document.getElementById("termInput");
const termSend = document.getElementById("termSend");
const termStatus = document.getElementById("termStatus");
const termCredits = document.getElementById("termCredits");

function escapeHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

// Ping the backend once on load just to set the status line — a failed
// ping doesn't block typing, it just tells the visitor what to expect.
fetch(API_URL, { method: "OPTIONS" })
  .then(() => { termStatus.textContent = "● backend online"; termStatus.style.color = "#22c55e"; })
  .catch(() => { termStatus.textContent = "● backend unreachable from this page"; termStatus.style.color = "#ff4d6d"; });

async function sendTerm() {
  const text = termInput.value.trim();
  if (!text) return;
  termInput.value = "";
  msgCount++;
  document.getElementById("msgCounter").textContent = msgCount;

  termBody.innerHTML += `<div><span class="prompt">&gt; ${escapeHtml(text)}</span></div>`;
  const loadingLine = document.createElement("div");
  loadingLine.className = "muted";
  loadingLine.textContent = "routing…";
  termBody.appendChild(loadingLine);
  termBody.scrollTop = termBody.scrollHeight;

  termHistory.push({ role: "user", content: text });

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: termHistory, web_search_enabled: true })
    });
    const data = await res.json();
    loadingLine.remove();
    termHistory.push({ role: "assistant", content: data.reply });

    termBody.innerHTML += `<div class="ok">✓ ${escapeHtml(data.reply || "")}</div>`;
    if (data.credits !== undefined) {
      termCredits.textContent = `credits: ${data.credits}`;
    }
  } catch (err) {
    loadingLine.textContent = "Backend unreachable from this page right now.";
  }
  termBody.scrollTop = termBody.scrollHeight;
}
termSend.addEventListener("click", sendTerm);
termInput.addEventListener("keydown", e => { if (e.key === "Enter") sendTerm(); });

// ---------------------------------------------------------------------
// FAQ accordion
// ---------------------------------------------------------------------
document.querySelectorAll(".faq-item").forEach(item => {
  item.querySelector(".faq-q").addEventListener("click", () => {
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("open"));
    if (!isOpen) item.classList.add("open");
  });
});

// ---------------------------------------------------------------------
// Router network canvas — lightweight connected-node field, cursor-reactive
// ---------------------------------------------------------------------
const netCanvas = document.getElementById("netCanvas");
const netCtx = netCanvas.getContext("2d");
let netNodes = [];
let netMouse = { x: -9999, y: -9999 };

function sizeNet() {
  const card = netCanvas.parentElement;
  netCanvas.width = card.clientWidth;
  netCanvas.height = card.clientHeight;
}
function initNet() {
  sizeNet();
  netNodes = [];
  const count = Math.floor((netCanvas.width * netCanvas.height) / 18000);
  for (let i = 0; i < count; i++) {
    netNodes.push({
      x: Math.random() * netCanvas.width,
      y: Math.random() * netCanvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25
    });
  }
}
function drawNet() {
  netCtx.clearRect(0, 0, netCanvas.width, netCanvas.height);
  for (const n of netNodes) {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0 || n.x > netCanvas.width) n.vx *= -1;
    if (n.y < 0 || n.y > netCanvas.height) n.vy *= -1;

    const dx = n.x - netMouse.x, dy = n.y - netMouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 140) { n.x += dx / dist * 0.6; n.y += dy / dist * 0.6; }
  }
  for (let i = 0; i < netNodes.length; i++) {
    for (let j = i + 1; j < netNodes.length; j++) {
      const a = netNodes[i], b = netNodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 120) {
        netCtx.strokeStyle = `rgba(16,163,127,${0.18 * (1 - d / 120)})`;
        netCtx.lineWidth = 1;
        netCtx.beginPath(); netCtx.moveTo(a.x, a.y); netCtx.lineTo(b.x, b.y); netCtx.stroke();
      }
    }
  }
  for (const n of netNodes) {
    netCtx.fillStyle = "rgba(16,163,127,0.6)";
    netCtx.beginPath(); netCtx.arc(n.x, n.y, 2, 0, Math.PI * 2); netCtx.fill();
  }
  requestAnimationFrame(drawNet);
}
initNet();
drawNet();
window.addEventListener("resize", initNet);
netCanvas.parentElement.addEventListener("mousemove", e => {
  const r = netCanvas.getBoundingClientRect();
  netMouse.x = e.clientX - r.left;
  netMouse.y = e.clientY - r.top;
});
netCanvas.parentElement.addEventListener("mouseleave", () => { netMouse.x = -9999; netMouse.y = -9999; });
