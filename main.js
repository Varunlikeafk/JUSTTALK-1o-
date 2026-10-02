/* =========================================================================
   REGEN 1 ALPHA — client
   Views: auth -> hub -> warp transition -> chat
   ========================================================================= */

const API_URL = "https://justtalk-regen.vercel.app/front.html";
const LS_ACCOUNTS = "jt_accounts";     // { username: password }  (local demo auth only)
const LS_SESSION  = "jt_session";      // { username, guest }
const LS_HISTORY  = "jt_chat_history"; // persisted chat history

// ---------------------------------------------------------------------
// Background: connected-node network (same as landing.html "netCanvas"),
// orange nodes, cursor-reactive. Paused while the chat view is open.
// ---------------------------------------------------------------------
const starCanvas = document.getElementById("starfield");
const starCtx = starCanvas.getContext("2d");
let netNodes = [];
const netMouse = { x: -9999, y: -9999 };

function initNet() {
  starCanvas.width = window.innerWidth;
  starCanvas.height = window.innerHeight;
  const count = Math.min(110, Math.floor((starCanvas.width * starCanvas.height) / 18000));
  netNodes = [];
  for (let i = 0; i < count; i++) {
    netNodes.push({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25
    });
  }
}
// Colours for the node network follow the active theme.
let netLine = "167,243,208", netNode = "rgba(110,231,183,0.7)", netLineAlpha = 0.12;
function syncNetColors() {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  netLine = light ? "13,143,108" : "167,243,208";
  netNode = light ? "rgba(13,143,108,0.55)" : "rgba(110,231,183,0.7)";
  netLineAlpha = light ? 0.2 : 0.12;
}
syncNetColors();
function drawNet() {
  requestAnimationFrame(drawNet);
  const chatView = document.getElementById("view-chat");
  if (chatView && chatView.classList.contains("active")) return; // hidden behind chat, save CPU

  const w = starCanvas.width, h = starCanvas.height;
  starCtx.clearRect(0, 0, w, h);
  for (const n of netNodes) {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0 || n.x > w) n.vx *= -1;
    if (n.y < 0 || n.y > h) n.vy *= -1;
    const dx = n.x - netMouse.x, dy = n.y - netMouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 140 && dist > 0) { n.x += dx / dist * 0.6; n.y += dy / dist * 0.6; }
  }
  for (let i = 0; i < netNodes.length; i++) {
    for (let j = i + 1; j < netNodes.length; j++) {
      const a = netNodes[i], b = netNodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 120) {
        starCtx.strokeStyle = `rgba(${netLine},${netLineAlpha * (1 - d / 120)})`;
        starCtx.lineWidth = 1;
        starCtx.beginPath(); starCtx.moveTo(a.x, a.y); starCtx.lineTo(b.x, b.y); starCtx.stroke();
      }
    }
  }
  starCtx.fillStyle = netNode;
  for (const n of netNodes) {
    starCtx.beginPath(); starCtx.arc(n.x, n.y, 2, 0, Math.PI * 2); starCtx.fill();
  }
}
initNet();
drawNet();
window.addEventListener("resize", initNet);
window.addEventListener("mousemove", e => { netMouse.x = e.clientX; netMouse.y = e.clientY; });
window.addEventListener("mouseleave", () => { netMouse.x = -9999; netMouse.y = -9999; });

// ---------------------------------------------------------------------
// View router
// ---------------------------------------------------------------------
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.body.dataset.view = id;
}

// ---------------------------------------------------------------------
// Splash view (app wordmark) -> auth
// ---------------------------------------------------------------------
const splashView = document.getElementById("view-splash");
function leaveSplash() {
  showView("view-auth");
}
splashView.addEventListener("click", leaveSplash);
window.addEventListener("keydown", (e) => {
  if (splashView.classList.contains("active") && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    leaveSplash();
  }
});

// ---------------------------------------------------------------------
// Session / mock auth
// NOTE: there is no auth backend — this app only has a /chat endpoint.
// Sign in / Sign up are a local, browser-only demo (credentials are
// stored in this browser's localStorage, not on any server).
// ---------------------------------------------------------------------
function getAccounts() {
  try { return JSON.parse(localStorage.getItem(LS_ACCOUNTS)) || {}; }
  catch { return {}; }
}
function saveAccounts(a) { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(a)); }
function getSession() {
  try { return JSON.parse(localStorage.getItem(LS_SESSION)); }
  catch { return null; }
}
function setSession(s) { localStorage.setItem(LS_SESSION, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(LS_SESSION); }

let authMode = "signin"; // or "signup"

const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const authSubmit = document.getElementById("authSubmit");
const authError = document.getElementById("authError");
const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");

tabSignIn.addEventListener("click", () => {
  authMode = "signin";
  tabSignIn.classList.add("active");
  tabSignUp.classList.remove("active");
  authSubmit.textContent = "Sign in";
  authError.textContent = "";
});
tabSignUp.addEventListener("click", () => {
  authMode = "signup";
  tabSignUp.classList.add("active");
  tabSignIn.classList.remove("active");
  authSubmit.textContent = "Create account";
  authError.textContent = "";
});

authSubmit.addEventListener("click", () => {
  const u = authUser.value.trim();
  const p = authPass.value;
  authError.textContent = "";

  if (!u || !p) { authError.textContent = "Enter a username and password."; return; }

  const accounts = getAccounts();

  if (authMode === "signup") {
    if (accounts[u]) { authError.textContent = "That username is already taken."; return; }
    accounts[u] = p;
    saveAccounts(accounts);
    setSession({ username: u, guest: false });
    enterHub();
  } else {
    if (!accounts[u] || accounts[u] !== p) {
      authError.textContent = "Incorrect username or password.";
      return;
    }
    setSession({ username: u, guest: false });
    enterHub();
  }
});

document.getElementById("guestBtn").addEventListener("click", () => {
  setSession({ username: "Guest", guest: true });
  enterHub();
});

[authUser, authPass].forEach(el => {
  el.addEventListener("keydown", e => { if (e.key === "Enter") authSubmit.click(); });
});

// ---------------------------------------------------------------------
// Hub view
// ---------------------------------------------------------------------
function enterHub() {
  const s = getSession();
  document.getElementById("hubUserLabel").textContent = s ? s.username : "Guest";
  showView("view-hub");
}

document.getElementById("hubLogout").addEventListener("click", doLogout);
document.getElementById("logoutBtn").addEventListener("click", doLogout);

function doLogout() {
  clearSession();
  authUser.value = "";
  authPass.value = "";
  showView("view-auth");
}

document.getElementById("cardAlpha").addEventListener("click", () => runWarpThenChat());
// Regen Adaptive card is inert on purpose (coming soon).

// Cursor-follow spotlight highlight on the model cards.
document.querySelectorAll(".model-card").forEach(card => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  });
});

// ---------------------------------------------------------------------
// Warp transition (canvas starfield "piercing" through space)
// ---------------------------------------------------------------------
const warpCanvas = document.getElementById("warp-canvas");
const warpCtx = warpCanvas.getContext("2d");
let warpStars = [];
let warpRAF = null;
let warpStartTime = 0;
const WARP_DURATION = 2600; // ms, matches the CSS flash/caption timing

function initWarp() {
  warpCanvas.width = window.innerWidth;
  warpCanvas.height = window.innerHeight;
  warpStars = [];
  for (let i = 0; i < 700; i++) {
    warpStars.push({
      x: (Math.random() - 0.5) * warpCanvas.width,
      y: (Math.random() - 0.5) * warpCanvas.height,
      z: Math.random() * warpCanvas.width,
      c: Math.floor(Math.random() * 3)
    });
  }
  warpCtx.fillStyle = "#04120e";
  warpCtx.fillRect(0, 0, warpCanvas.width, warpCanvas.height);
}

// Classic "jump to lightspeed" look: points near the centre barely move at
// first, then accelerate outward into long white streaks as speed ramps up,
// exactly like looking straight out the front window of a ship. No shapes,
// no icons — just stars stretching into lines.
function drawWarp(now) {
  if (!warpStartTime) warpStartTime = now;
  const elapsed = now - warpStartTime;
  const progress = Math.min(1, elapsed / WARP_DURATION);
  // ease-in acceleration curve: slow at first, screaming fast by the end
  const speed = 4 + Math.pow(progress, 2.4) * 90;

  const cx = warpCanvas.width / 2, cy = warpCanvas.height / 2;

  // Lower alpha trail = longer streak lines as speed increases
  const trailAlpha = 0.5 - progress * 0.35;
  warpCtx.fillStyle = `rgba(4,18,14,${Math.max(0.12, trailAlpha)})`;
  warpCtx.fillRect(0, 0, warpCanvas.width, warpCanvas.height);

  for (const s of warpStars) {
    const prevZ = s.z;
    s.z -= speed;
    if (s.z <= 1) {
      s.x = (Math.random() - 0.5) * warpCanvas.width;
      s.y = (Math.random() - 0.5) * warpCanvas.height;
      s.z = warpCanvas.width;
    }
    const k = 128 / s.z;
    const px = s.x * k + cx, py = s.y * k + cy;
    const pk = 128 / prevZ;
    const ppx = s.x * pk + cx, ppy = s.y * pk + cy;

    const depthFactor = 1 - s.z / warpCanvas.width;
    const size = Math.max(0.6, depthFactor * 2.4);
    const brightness = 0.5 + depthFactor * 0.5;
    const WARP_COLORS = ["220,255,240", "110,231,183", "25,195,125"];
    warpCtx.strokeStyle = `rgba(${WARP_COLORS[s.c || 0]},${brightness})`;
    warpCtx.lineWidth = size;
    warpCtx.beginPath();
    warpCtx.moveTo(ppx, ppy);
    warpCtx.lineTo(px, py);
    warpCtx.stroke();
  }
  warpRAF = requestAnimationFrame(drawWarp);
}

function runWarpThenChat() {
  initWarp();
  warpStartTime = 0;
  showView("view-warp");
  warpRAF = requestAnimationFrame(drawWarp);
  setTimeout(() => {
    cancelAnimationFrame(warpRAF);
    enterChat();
  }, WARP_DURATION);
}

// ---------------------------------------------------------------------
// Chat view bootstrap
// ---------------------------------------------------------------------
function enterChat() {
  const s = getSession() || { username: "Guest", guest: true };
  const initial = (s.username || "G").charAt(0).toUpperCase();
  document.getElementById("profileAvatar").textContent = initial;
  document.getElementById("profileName").textContent = s.username;
  showView("view-chat");
  initConvos();
  const hs = document.getElementById("historySearch");
  if (hs) { hs.value = ""; historyFilter = ""; }
  renderHistoryList();
  loadHistoryIntoUI();
}

document.getElementById("backToHub").addEventListener("click", () => {
  closeSidebarMobile();
  enterHub();
});
document.getElementById("aboutBtn").addEventListener("click", () => {
  alert("Regen 1 Alpha runs GPT-OSS-20B via Groq with optional live web verification. System credits track answer reliability: verified or successful answers earn credits, and only genuine verification failures cost credits (going offline or turning search off never does).");
});
document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  closeSidebarMobile();
  clearAllConvos();
});

// ---------------------------------------------------------------------
// Sidebar (mobile drawer)
// ---------------------------------------------------------------------
const sidebarEl = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
function openSidebarMobile() { sidebarEl.classList.add("open"); sidebarOverlay.classList.add("show"); }
function closeSidebarMobile() { sidebarEl.classList.remove("open"); sidebarOverlay.classList.remove("show"); }
document.getElementById("menuToggle").addEventListener("click", openSidebarMobile);
sidebarOverlay.addEventListener("click", closeSidebarMobile);

// ---------------------------------------------------------------------
// Chat logic
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Conversations (chat history): many chats per user, saved in localStorage.
// `chatHistory` is always an alias of the ACTIVE conversation's messages.
// ---------------------------------------------------------------------
const LS_CONVOS = "regen_convos_";
let convoStore = { activeId: null, convos: [] };
let chatHistory = [];
let historyFilter = "";

function convoKey() {
  const s = getSession();
  return LS_CONVOS + (s && !s.guest ? s.username : "guest");
}
function newId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function makeConvo() {
  const now = Date.now();
  return { id: newId(), title: "New chat", titled: false, createdAt: now, updatedAt: now, messages: [] };
}
function activeConvo() { return convoStore.convos.find(c => c.id === convoStore.activeId) || null; }
function titleFrom(msgs) {
  const first = msgs.find(m => m.role === "user");
  if (!first) return "New chat";
  const t = first.content.replace(/\s+/g, " ").trim();
  return t.length > 42 ? t.slice(0, 42).trimEnd() + "…" : t;
}
function stopStream() { if (window.__stream) window.__stream.finish(); }

function saveConvos() {
  try {
    const keep = convoStore.convos.filter(c => c.messages.length || c.id === convoStore.activeId);
    localStorage.setItem(convoKey(), JSON.stringify({ activeId: convoStore.activeId, convos: keep }));
  } catch (e) {}
}

function initConvos() {
  convoStore = { activeId: null, convos: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(convoKey()));
    if (saved && Array.isArray(saved.convos)) convoStore = { activeId: saved.activeId, convos: saved.convos };
  } catch (e) {}

  // One-time migration of the old single-conversation history.
  if (!convoStore.convos.length) {
    try {
      const legacy = JSON.parse(localStorage.getItem(LS_HISTORY));
      if (Array.isArray(legacy) && legacy.length) {
        const c = makeConvo();
        c.messages = legacy;
        c.title = titleFrom(legacy);
        convoStore.convos.push(c);
        convoStore.activeId = c.id;
        localStorage.removeItem(LS_HISTORY);
      }
    } catch (e) {}
  }

  convoStore.convos = convoStore.convos.filter(c => c.messages.length || c.id === convoStore.activeId);
  if (!activeConvo()) {
    const c = makeConvo();
    convoStore.convos.push(c);
    convoStore.activeId = c.id;
  }
  chatHistory = activeConvo().messages;
  saveConvos();
}

// Call after changing a conversation's messages.
function persistConvo(c) {
  if (!c || !convoStore.convos.includes(c)) return; // deleted while a reply was in flight
  if (c.messages.length > 300) c.messages.splice(0, c.messages.length - 300);
  c.updatedAt = Date.now();
  if (!c.titled) c.title = titleFrom(c.messages);
  saveConvos();
  renderHistoryList();
}

function switchConvo(id) {
  if (id === convoStore.activeId) { closeSidebarMobile(); return; }
  if (!convoStore.convos.some(c => c.id === id)) return;
  stopStream();
  convoStore.activeId = id;
  chatHistory = activeConvo().messages;
  saveConvos();
  loadHistoryIntoUI();
  renderHistoryList();
  closeSidebarMobile();
}

function newConvo() {
  stopStream();
  const cur = activeConvo();
  if (!cur || cur.messages.length) {
    const c = makeConvo();
    convoStore.convos.push(c);
    convoStore.activeId = c.id;
    chatHistory = c.messages;
  }
  saveConvos();
  loadHistoryIntoUI();
  renderHistoryList();
  closeSidebarMobile();
  const input = document.getElementById("userInput");
  if (input) input.focus();
}

function resetToFreshIfNeeded(wasActive) {
  if (!wasActive) return;
  stopStream();
  const next = convoStore.convos.filter(c => c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (next) convoStore.activeId = next.id;
  else {
    const c = makeConvo();
    convoStore.convos.push(c);
    convoStore.activeId = c.id;
  }
  chatHistory = activeConvo().messages;
  loadHistoryIntoUI();
}

function deleteConvo(id) {
  const c = convoStore.convos.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Delete "${c.title}"? This can't be undone.`)) return;
  const wasActive = id === convoStore.activeId;
  convoStore.convos = convoStore.convos.filter(x => x.id !== id);
  resetToFreshIfNeeded(wasActive);
  saveConvos();
  renderHistoryList();
}

function clearAllConvos() {
  if (!confirm("Delete ALL your chats? This can't be undone.")) return;
  convoStore.convos = [];
  resetToFreshIfNeeded(true);
  saveConvos();
  renderHistoryList();
}

function startRename(item) {
  const c = convoStore.convos.find(x => x.id === item.dataset.id);
  const titleEl = item.querySelector(".hist-title");
  if (!c || !titleEl) return;
  const input = document.createElement("input");
  input.className = "hist-rename";
  input.value = c.title;
  input.maxLength = 60;
  titleEl.replaceWith(input);
  const actions = item.querySelector(".hist-actions");
  if (actions) actions.style.display = "none";
  input.focus(); input.select();
  let done = false;
  const commit = (save) => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    if (save && v) { c.title = v; c.titled = true; saveConvos(); }
    renderHistoryList();
  };
  input.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(true); }
    else if (e.key === "Escape") commit(false);
  });
  input.addEventListener("blur", () => commit(true));
}

const ICON_EDIT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

function renderHistoryList() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const q = historyFilter.trim().toLowerCase();
  const items = convoStore.convos
    .filter(c => c.messages.length && (!q || c.title.toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!items.length) {
    list.innerHTML = `<div class="history-empty">${q ? "No chats match your search." : "Your conversations will appear here."}</div>`;
    return;
  }

  const DAY = 86400000;
  const d = new Date();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const labelFor = t => t >= today ? "Today" : t >= today - DAY ? "Yesterday" : t >= today - 7 * DAY ? "Previous 7 days" : "Older";

  let html = "", last = "";
  for (const c of items) {
    const label = labelFor(c.updatedAt);
    if (label !== last) { html += `<div class="hist-group">${label}</div>`; last = label; }
    html += `<div class="hist-item${c.id === convoStore.activeId ? " active" : ""}" data-id="${c.id}" role="button" tabindex="0" title="${escapeHtml(c.title)}">
      <span class="hist-title">${escapeHtml(c.title)}</span>
      <span class="hist-actions">
        <button type="button" class="hist-act" data-act="rename" aria-label="Rename chat">${ICON_EDIT}</button>
        <button type="button" class="hist-act danger" data-act="delete" aria-label="Delete chat">${ICON_TRASH}</button>
      </span>
    </div>`;
  }
  list.innerHTML = html;
}

(function wireHistoryList() {
  const list = document.getElementById("historyList");
  const search = document.getElementById("historySearch");
  if (list) {
    list.addEventListener("click", e => {
      const item = e.target.closest(".hist-item");
      if (!item || e.target.closest(".hist-rename")) return;
      const act = e.target.closest("[data-act]");
      if (act) {
        e.stopPropagation();
        if (act.dataset.act === "rename") startRename(item);
        else if (act.dataset.act === "delete") deleteConvo(item.dataset.id);
        return;
      }
      switchConvo(item.dataset.id);
    });
    list.addEventListener("keydown", e => {
      const item = e.target.closest(".hist-item");
      if (item && e.target === item && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        switchConvo(item.dataset.id);
      }
    });
  }
  if (search) search.addEventListener("input", () => { historyFilter = search.value; renderHistoryList(); });
})();

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Turns fenced ```code``` blocks into copy-able boxes and escapes the rest.
// This is the "copy paste box" feature: any code or long paragraph the
// model returns gets its own box with a Copy button.
function renderBotContent(raw) {
  const codeFence = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let html = "";
  let match;
  let boxCount = 0;

  while ((match = codeFence.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index);
    if (before.trim()) html += renderParagraphs(before);

    const lang = match[1] || "text";
    const code = match[2];
    boxCount++;
    const codeId = `code-${Date.now()}-${boxCount}`;
    html += `
      <div class="code-box">
        <div class="code-box-header">
          <span>${escapeHtml(lang)}</span>
          <button onclick="copyBoxText('${codeId}', this)">Copy</button>
        </div>
        <pre id="${codeId}">${escapeHtml(code.trim())}</pre>
      </div>`;
    lastIndex = codeFence.lastIndex;
  }
  const rest = raw.slice(lastIndex);
  if (rest.trim()) html += renderParagraphs(rest);
  return (html || renderParagraphs(raw)).replace(/>\s*\n\s*</g, '><').trim();
}

// Long plain-text paragraphs (>= 400 chars, no code fence) also get wrapped
// in a copyable box, per the "any copy paste stuff -> box" request.
function renderParagraphs(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length >= 400) {
    const codeId = `para-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    return `
      <div class="code-box">
        <div class="code-box-header">
          <span>Response text</span>
          <button onclick="copyBoxText('${codeId}', this)">Copy</button>
        </div>
        <pre id="${codeId}" style="white-space:pre-wrap;font-family:inherit;font-size:14.5px;">${escapeHtml(trimmed)}</pre>
      </div>`;
  }
  return `<span>${escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</span>`;
}

function copyBoxText(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = old; }, 1200);
  });
}

function copyWholeMessage(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = old; }, 1200);
  });
}

function toggleThink(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const bar = el.closest(".think-bar");
  if (bar) bar.classList.toggle("open");
}


// Animated credit counter (count-up/down + bump), matches landing motion.
function setCredits(target) {
  const el = document.getElementById("creditDisplay");
  const from = parseInt(el.textContent, 10) || 0;
  const t0 = performance.now(), dur = 600;
  el.style.color = target < 700 ? "#f43f5e" : "#22c55e";
  const bar = document.getElementById("creditBar");
  if (bar) { bar.style.width = Math.max(4, Math.min(100, target / 10)) + "%"; bar.classList.toggle("neg", target < 700); }
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toggleBtn() {
  const input = document.getElementById("userInput");
  const btn = document.getElementById("sendBtn");
  if (input.value.trim()) btn.classList.add("active"); else btn.classList.remove("active");
}

function loadHistoryIntoUI() {
  const chatFlow = document.getElementById("chat-flow");
  chatFlow.innerHTML = "";
  let html = "";
  chatHistory.forEach((turn, i) => {
    if (turn.role === "user") {
      html += `
        <div class="chat-row user-row">
          <div class="bubble-container"><div class="user-bubble">${escapeHtml(turn.content)}</div></div>
          <div class="avatar user-avatar">U</div>
        </div>`;
    } else {
      const msgId = `msg-h${i}-${Date.now()}`;
      const thinkId = `think-h${i}-${Date.now()}`;
      const think = turn.thought ? `
            <div class="think-bar">
              <div class="think-header" onclick="toggleThink('${thinkId}')"><span>🧠 Inner Thought Process</span><span class="arrow">▼</span></div>
              ${routerChips(detectRouter(turn.thought))}
              <div class="think-body"><div class="think-content" id="${thinkId}">${escapeHtml(turn.thought)}</div></div>
            </div>` : "";
      const pill = turn.time != null ? `<span class="meta-pill">⚡ ${turn.time}s</span>` : "";
      html += `
        <div class="chat-row bot-row">
          <div class="avatar bot-avatar">R</div>
          <div class="bubble-container">${think}
            <div class="bot-bubble" id="${msgId}">${renderBotContent(turn.content)}</div>
            <div class="meta-row">${pill}<button class="copy-msg-btn" onclick="copyWholeMessage('${msgId}', this)">Copy</button></div>
          </div>
        </div>`;
    }
  });
  chatFlow.innerHTML = html;
  chatFlow.scrollTop = chatFlow.scrollHeight;
}

async function send() {
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  if (window.__stream) window.__stream.finish();

  const convo = activeConvo();   // the chat this message belongs to, even if the user switches chats while waiting
  if (!convo) return;
  const chatFlow = document.getElementById("chat-flow");
  const creditDisplay = document.getElementById("creditDisplay");

  chatFlow.innerHTML += `
    <div class="chat-row user-row msg-enter">
      <div class="bubble-container"><div class="user-bubble">${escapeHtml(text)}</div></div>
      <div class="avatar user-avatar">U</div>
    </div>`;

  input.value = "";
  toggleBtn();
  chatFlow.scrollTop = chatFlow.scrollHeight;

  // BUG FIX: previously the array was trimmed to 8 entries right after
  // pushing the user turn (before the assistant reply existed), which could
  // silently drop the *other* half of an exchange and desync context sent
  // to the server. Now we push, persist and trim only in complete pairs.
  convo.messages.push({ role: "user", content: text });
  persistConvo(convo);

  const thinkId = "think-" + Date.now();

  chatFlow.innerHTML += `
    <div class="chat-row bot-row msg-enter" id="loading-${thinkId}">
      <div class="avatar bot-avatar">R</div>
      <div class="bubble-container">
        <div class="think-bar live open">
          <div class="think-header" onclick="toggleThink('${thinkId}')">
            <span>🧠 Thinking Process...</span><span class="arrow">▼</span>
          </div>
          ${routerChips(-1)}
          <div class="think-body"><div class="think-content routing" id="${thinkId}">routing…</div></div>
        </div>
      </div>
    </div>`;
  chatFlow.scrollTop = chatFlow.scrollHeight;

  try {
    const webSearchToggle = document.getElementById("webSearchToggle");
    const webSearchEnabled = webSearchToggle ? webSearchToggle.checked : true;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the full retained history (not just the last few pairs) so the
      // backend has real context to work with.
      body: JSON.stringify({
        message: text,
        // everything before the message being sent (the server adds the new message itself)
        history: convo.messages.slice(0, -1).map(({ role, content }) => ({ role, content })),
        web_search_enabled: webSearchEnabled
      })
    });
    const data = await res.json();

    const prevCredits = parseInt(creditDisplay.textContent, 10) || 0;
    const delta = data.credits !== undefined ? data.credits - prevCredits : 0;
    const deltaPill = delta ? `<span class="delta ${delta > 0 ? "pos" : "neg"}">${delta > 0 ? "+" : ""}${delta}</span>` : "";

    const loadEl = document.getElementById(`loading-${thinkId}`);
    if (loadEl) loadEl.remove();

    convo.messages.push({ role: "assistant", content: data.reply, thought: data.thought || "", time: data.response_time });
    persistConvo(convo);
    if (data.credits !== undefined) setCredits(data.credits);
    if (convoStore.activeId !== convo.id) return; // user switched chats; reply is saved in the right one

    const msgId = `msg-${Date.now()}`;
    chatFlow.innerHTML += `
      <div class="chat-row bot-row msg-enter">
        <div class="avatar bot-avatar">R</div>
        <div class="bubble-container">
          <div class="think-bar">
            <div class="think-header" onclick="toggleThink('${thinkId}')">
              <span>🧠 Inner Thought Process</span><span class="arrow">▼</span>
            </div>
            ${routerChips(detectRouter(data.thought))}
            <div class="think-body"><div class="think-content" id="${thinkId}">${escapeHtml(data.thought || "")}</div></div>
          </div>
          <div class="bot-bubble" id="${msgId}">${renderBotContent(data.reply || "")}</div>
          <div class="meta-row">
            <span class="meta-pill">⚡ ${data.response_time}s</span>${deltaPill}
            <button class="copy-msg-btn" onclick="copyWholeMessage('${msgId}', this)">Copy</button>
          </div>
        </div>
      </div>`;

    chatFlow.scrollTop = chatFlow.scrollHeight;
    streamBubble(msgId, data.thought || "");
  } catch (err) {
    const loadEl = document.getElementById(`loading-${thinkId}`);
    if (loadEl) loadEl.remove();
    if (convoStore.activeId === convo.id) chatFlow.innerHTML += `
      <div class="chat-row bot-row msg-enter">
        <div class="avatar bot-avatar">R</div>
        <div class="bubble-container"><div class="bot-bubble" style="color:#f43f5e;">Server connection offline. Your message wasn't lost — it's still in this conversation's history once the server is back.</div></div>
      </div>`;
    // Roll back the optimistic push so a dropped request doesn't leave a
    // one-sided (user-only) turn baked into history forever.
    const m = convo.messages;
    if (m.length && m[m.length - 1].role === "user") m.pop();
    persistConvo(convo);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const newChatBtn = document.getElementById("newChatBtn");

  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
  userInput.addEventListener("input", toggleBtn);
  sendBtn.addEventListener("click", send);

  if (newChatBtn) newChatBtn.addEventListener("click", newConvo);

  // Resume session on reload instead of forcing sign-in again every time.
  const existing = getSession();
  if (existing) enterHub();
});


// ---------------------------------------------------------------------
// Landing-page UX: router chips, empty-state hero, suggestion chips
// ---------------------------------------------------------------------
const ROUTERS = ["Temporal", "Identity", "Generation", "Factual", "Fallback"];

// Same 5-router flow as landing.html. active = index that answered,
// earlier ones are "passed" (first match wins), -1 = still scanning.
function routerChips(active) {
  const steps = ROUTERS.map((n, i) => {
    const st = active < 0 ? "" : (i < active ? "passed" : (i === active ? "active" : "idle"));
    return `<div class="router-step ${st}" style="--i:${i}"><b>${i + 1}</b> ${n}</div>` +
           (i < ROUTERS.length - 1 ? '<span class="router-arrow">→</span>' : "");
  }).join("");
  return `<div class="router-flow${active < 0 ? " scanning" : ""}">${steps}</div>`;
}

function detectRouter(thought) {
  const t = (thought || "").split("\n\n--- Model reasoning ---")[0];
  if (/SYSTEM ROUTER/i.test(t)) return 0;
  if (/Identity query/i.test(t)) return 1;
  if (/GENERATION|Generation Error|CAREFUL MODE RECOVERY/.test(t)) return 2;
  if (/WEB VERIFIED/.test(t)) return 3;
  return 4;
}

document.addEventListener("DOMContentLoaded", () => {
  const flow = document.getElementById("chat-flow");
  const empty = document.getElementById("empty-state");
  const sync = () => empty.classList.toggle("hide", flow.childElementCount > 0);
  new MutationObserver(sync).observe(flow, { childList: true });
  sync();

  empty.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const input = document.getElementById("userInput");
      input.value = chip.dataset.q;
      toggleBtn();
      send();
    });
  });
});


/* =========================================================================
   STREAMING TEXT ANIMATION
   Words resolve out of blur one by one, a caret trails the text, then the
   action icons, source chip and follow-up prompts fade in and become usable.
   ========================================================================= */
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ACTION_ICONS = {
  copy:  '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  retry: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
  up:    '<path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/>',
  down:  '<path d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/>'
};
const FOLLOW_UPS = ["Explain that more simply", "Give me an example"];

function svgIcon(name) {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ACTION_ICONS[name]}</svg>`;
}

function sourceDomain(thought) {
  const m = /Source:\s*(https?:\/\/[^\s.][^\s]*)/i.exec(thought || "");
  if (!m) return null;
  try { const u = new URL(m[1]); return { href: u.href, domain: u.hostname.replace(/^www\./, "") }; }
  catch (e) { return null; }
}

function buildExtras(bubble, thought) {
  const wrap = document.createElement("div");
  wrap.className = "stream-extras";
  const src = sourceDomain(thought);
  wrap.innerHTML = `
    <div class="stream-actions">
      ${["copy", "retry", "up", "down"].map(n => `<button type="button" class="act-btn" data-act="${n}" aria-label="${n}">${svgIcon(n)}</button>`).join("")}
      ${src ? `<a class="src-chip" href="${src.href}" target="_blank" rel="noreferrer"><span class="src-dot"></span>${escapeHtml(src.domain)}</a>` : ""}
    </div>
    <div class="stream-followups">
      <div class="fu-title">Follow-ups</div>
      ${FOLLOW_UPS.map((t, i) => `<button type="button" class="fu-btn" style="--i:${i}">↳ ${t}</button>`).join("")}
    </div>`;
  wrap.querySelector('[data-act="copy"]').onclick = () =>
    navigator.clipboard.writeText(bubble.innerText).catch(() => {});
  wrap.querySelector('[data-act="retry"]').onclick = () => {
    const last = [...chatHistory].reverse().find(t => t.role === "user");
    if (!last) return;
    document.getElementById("userInput").value = last.content;
    send();
  };
  ["up", "down"].forEach(n => {
    wrap.querySelector(`[data-act="${n}"]`).onclick = e => {
      const row = wrap.querySelector(".stream-actions");
      row.querySelectorAll('[data-act="up"],[data-act="down"]').forEach(b => b.classList.remove("on"));
      e.currentTarget.classList.add("on");
    };
  });
  wrap.querySelectorAll(".fu-btn").forEach(b => b.onclick = () => {
    document.getElementById("userInput").value = b.textContent.replace("↳ ", "");
    send();
  });
  return wrap;
}

function streamBubble(bubbleId, thought) {
  const bubble = document.getElementById(bubbleId);
  if (!bubble) return;
  const container = bubble.parentElement;
  const original = bubble.innerHTML;
  const extras = buildExtras(bubble, thought);
  const meta = container.querySelector(".meta-row");
  (meta || bubble).insertAdjacentElement("afterend", extras);

  const reveal = () => extras.classList.add("show");
  if (REDUCED_MOTION) { reveal(); return; }

  // wrap every word of the text (code blocks fade in as one block instead)
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const total = nodes.reduce((n, t) => n + (t.nodeValue.match(/\S+/g) || []).length, 0) || 1;
  const step = Math.min(70, 3200 / total);
  let idx = 0;
  nodes.forEach(node => {
    const inCode = node.parentElement.closest('pre[id^="code-"]');
    if (inCode) return;
    const frag = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const sp = document.createElement("span");
      sp.className = "sw";
      sp.style.animationDelay = (idx++ * step) + "ms";
      sp.textContent = part;
      frag.appendChild(sp);
    });
    node.replaceWith(frag);
  });
  bubble.querySelectorAll(".code-box").forEach(box => {
    if (box.querySelector('pre[id^="code-"]')) {
      box.classList.add("sw-block");
      box.style.animationDelay = (idx * step) + "ms";
      idx++;
    }
  });
  const caret = document.createElement("span");
  caret.className = "stream-caret";
  bubble.appendChild(caret);

  const flow = document.getElementById("chat-flow");
  const scroller = setInterval(() => { flow.scrollTop = flow.scrollHeight; }, 120);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(scroller);
    clearTimeout(timer);
    if (document.body.contains(bubble)) bubble.innerHTML = original; // clean DOM, no replay
    reveal();
    if (window.__stream && window.__stream.finish === finish) window.__stream = null;
  };
  const timer = setTimeout(finish, idx * step + 450);
  window.__stream = { finish };
}

// ---------------------------------------------------------------------
// Theme (dark / light) with circular-reveal transition
// ---------------------------------------------------------------------
const LS_THEME = "regen_theme";
const root = document.documentElement;

function currentTheme() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }

function applyTheme(t) {
  root.setAttribute("data-theme", t);
  try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f3faf6" : "#04120e");
  document.querySelectorAll(".theme-toggle").forEach(b => b.setAttribute("aria-pressed", t === "light"));
  syncNetColors();
}

function switchTheme(originEl) {
  const next = currentTheme() === "dark" ? "light" : "dark";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fallback (no View Transitions API / reduced motion): soft cross-fade of colours.
  if (!document.startViewTransition || reduced) {
    if (!reduced) {
      root.classList.add("theme-fade");
      setTimeout(() => root.classList.remove("theme-fade"), 700);
    }
    applyTheme(next);
    return;
  }

  const rect = originEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const vt = document.startViewTransition(() => applyTheme(next));
  vt.ready.then(() => {
    // new theme grows out of the button as a circle...
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 750, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" }
    );
    // ...while the old theme softly recedes underneath it.
    root.animate(
      { filter: ["blur(0px) brightness(1)", "blur(6px) brightness(.9)"], transform: ["scale(1)", "scale(1.025)"] },
      { duration: 750, easing: "ease-out", fill: "forwards", pseudoElement: "::view-transition-old(root)" }
    );
  });
}

document.querySelectorAll(".theme-toggle").forEach(btn => {
  btn.addEventListener("click", () => switchTheme(btn));
});
applyTheme(currentTheme());
