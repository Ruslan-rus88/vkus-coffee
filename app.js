/* ===== Vkus Coffee — order studio ===== */

const MENU = [
  { id: "capuchino", name: "Capuchino", price: 10,  emoji: "☕" },
  { id: "coffee",    name: "Coffee",    price: 20,  emoji: "🫖" },
  { id: "hotwater",  name: "Hot Water", price: 2,   emoji: "💧" },
  { id: "flatwhite", name: "Flat White", price: 15, emoji: "🥛" },
  { id: "espresso",  name: "Espresso",  price: 100, emoji: "⚡" },
  { id: "surprise",  name: "Surprise!", price: null, emoji: "🎁", surprise: true },
];

const CLIENTS = [
  "Ruslan", "Katrine", "Dudi Turki", "Manya Anna",
  "Raman", "Karim", "Shaalan", "Daniil",
];

const DOT_LABELS      = ["Small",  "Medium",  "Large"];
const STRENGTH_LABELS = ["Mild",   "Regular", "Strong"];
const STATUSES        = ["Created", "Ready",   "Done"];
const STORE_KEY       = "vkus.coffee.orders";
const SETTINGS_KEY    = "vkus.coffee.settings";
const DEFAULT_SETTINGS = { sound: false, testing: false, autoSurprise: false };

/* ---------- State ---------- */
let orders   = load();
let settings = loadSettings();
const draft  = { menuId: null, size: 2, strength: 2, client: null };

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(orders));
}
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function timeLabel(ts) {
  return new Date(ts).toLocaleString([], {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
  });
}

/* Resolve a drink — handles both manual and auto surprise */
function resolveDrink(menuId, surpriseId) {
  const item = MENU.find((m) => m.id === menuId);
  if (!item) return null;
  if (item.surprise) {
    if (surpriseId) {
      const pick = MENU.find((m) => m.id === surpriseId);
      if (pick) return { name: `Surprise: ${pick.name}`, price: pick.price, emoji: "🎁" };
    }
    return { name: "Surprise!", price: null, emoji: "🎁" };
  }
  return { name: item.name, price: item.price, emoji: item.emoji };
}

/* ---------- Sound ---------- */
let audioCtx = null;
function playSound(type) {
  if (!settings.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx  = audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === "tap") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.08);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.start(t); osc.stop(t + 0.11);
    } else if (type === "add") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.setValueAtTime(659, t + 0.11);
      osc.frequency.setValueAtTime(784, t + 0.22);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.setValueAtTime(0.22, t + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
      osc.start(t); osc.stop(t + 0.44);
    } else if (type === "delete") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.18);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t); osc.stop(t + 0.22);
    }
  } catch {}
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-shown"), 2200);
}

/* ---------- Build the New Order form ---------- */
function buildMenu() {
  const wrap = $("#menu");
  wrap.innerHTML = "";
  MENU.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "menu-item" + (item.surprise ? " menu-item--surprise" : "");
    btn.dataset.id = item.id;
    const price = item.surprise ? "Mystery" : `€${item.price}`;
    btn.innerHTML = `
      <span class="menu-item__emoji">${item.emoji}</span>
      <span class="menu-item__name">${item.name}</span>
      <span class="menu-item__price">${price}</span>`;
    btn.addEventListener("click", () => {
      draft.menuId = item.id;
      $$("#menu .menu-item").forEach((b) => b.classList.toggle("is-active", b === btn));
      updateSummary();
      playSound("tap");
    });
    wrap.appendChild(btn);
  });
}

function buildDots(containerId, labels, key) {
  const wrap = $("#" + containerId);
  wrap.innerHTML = "";
  for (let i = 1; i <= 3; i++) {
    const opt = document.createElement("button");
    opt.className = "dot-opt" + (i === draft[key] ? " is-active" : "");
    opt.dataset.level = i;
    const dots = Array.from({ length: i }, () => "<i></i>").join("");
    opt.innerHTML = `<span class="dot-opt__dots">${dots}</span>
                     <span class="dot-opt__label">${labels[i - 1]}</span>`;
    opt.addEventListener("click", () => {
      draft[key] = i;
      $$("#" + containerId + " .dot-opt").forEach((o) => o.classList.toggle("is-active", o === opt));
      updateSummary();
      playSound("tap");
    });
    wrap.appendChild(opt);
  }
}

function buildClients() {
  const wrap = $("#clients");
  wrap.innerHTML = "";
  CLIENTS.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "client";
    btn.innerHTML = `<span class="client__av">${initials(name)}</span>${name}`;
    btn.addEventListener("click", () => {
      draft.client = name;
      $$("#clients .client").forEach((b) => b.classList.toggle("is-active", b === btn));
      updateSummary();
      playSound("tap");
    });
    wrap.appendChild(btn);
  });
}

function updateSummary() {
  const item   = MENU.find((m) => m.id === draft.menuId);
  const addBtn = $("#addBtn");
  if (!item) {
    $("#sumDrink").textContent = "No drink selected";
    $("#sumMeta").textContent  = "—";
    $("#sumPrice").textContent = "€0";
    addBtn.disabled = true;
    return;
  }
  $("#sumDrink").textContent = item.name;
  $("#sumMeta").textContent  = [
    DOT_LABELS[draft.size - 1],
    STRENGTH_LABELS[draft.strength - 1],
    draft.client || "no client",
  ].join(" · ");
  $("#sumPrice").textContent = item.surprise ? "€ ?" : `€${item.price}`;
  addBtn.disabled = !draft.client;
}

/* ---------- Add order ---------- */
function addOrder() {
  if (!draft.menuId || !draft.client) {
    toast("Pick a drink and a client first");
    return;
  }
  const item = MENU.find((m) => m.id === draft.menuId);
  let surpriseId = null;
  if (item.surprise && settings.autoSurprise) {
    const pool = MENU.filter((m) => !m.surprise);
    surpriseId = pool[Math.floor(Math.random() * pool.length)].id;
  }
  orders.unshift({
    id: uid(),
    menuId: draft.menuId,
    surpriseId,
    size: draft.size,
    strength: draft.strength,
    client: draft.client,
    status: "Created",
    createdAt: Date.now(),
  });
  save();
  resetDraft();
  render();
  playSound("add");
  toast("Order added ☕");
  switchTab("active", true);
}

function resetDraft() {
  draft.menuId = null;
  draft.size   = 2;
  draft.strength = 2;
  draft.client = null;
  $$("#menu .menu-item").forEach((b) => b.classList.remove("is-active"));
  $$("#clients .client").forEach((b) => b.classList.remove("is-active"));
  $$("#size .dot-opt").forEach((o) => o.classList.toggle("is-active", o.dataset.level === "2"));
  $$("#strength .dot-opt").forEach((o) => o.classList.toggle("is-active", o.dataset.level === "2"));
  updateSummary();
}

/* ---------- Order actions ---------- */
function setStatus(id, status) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  o.status = status;
  save();
  render();
  playSound("tap");
}
function deleteOrder(id) {
  orders = orders.filter((x) => x.id !== id);
  save();
  render();
  playSound("delete");
  toast("Order deleted");
}

/* ---------- Render active orders ---------- */
function dotsHtml(level) {
  return Array.from({ length: 3 }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("");
}

function render() {
  const wrap = $("#orders");
  wrap.innerHTML = "";
  $("#activeCount").textContent = orders.length;
  $("#tabBadge").textContent    = orders.length;
  $("#empty").classList.toggle("is-shown", orders.length === 0);

  orders.forEach((o) => {
    const drink = resolveDrink(o.menuId, o.surpriseId);
    const card  = document.createElement("div");
    card.className   = "order";
    card.dataset.status = o.status;

    const statusBtns = STATUSES.map((s) =>
      `<button class="status-btn ${s === o.status ? "is-active" : ""}" data-s="${s}">${s}</button>`
    ).join("");

    card.innerHTML = `
      <div class="order__top">
        <div class="order__main">
          <div class="order__emoji">${drink.emoji}</div>
          <div>
            <div class="order__name">${drink.name}</div>
            <div class="order__client">
              <span class="client__av" style="width:18px;height:18px;font-size:9px;">${initials(o.client)}</span>
              ${o.client}
            </div>
          </div>
        </div>
        <div class="order__price">${drink.price != null ? `€${drink.price}` : "€ ?"}</div>
      </div>
      <div class="order__attrs">
        <div class="attr">
          <span class="attr__label">Strength</span>
          <span class="attr__dots">${dotsHtml(o.strength)}</span>
        </div>
        <div class="attr">
          <span class="attr__label">Size</span>
          <span class="attr__dots">${dotsHtml(o.size)}</span>
        </div>
      </div>
      <div class="order__foot">
        <div class="status-group">${statusBtns}</div>
        <button class="del-btn" title="Delete order">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
      <div class="order__time">Ordered ${timeLabel(o.createdAt)}</div>`;

    card.querySelectorAll(".status-btn").forEach((b) =>
      b.addEventListener("click", () => setStatus(o.id, b.dataset.s)));
    card.querySelector(".del-btn").addEventListener("click", () => deleteOrder(o.id));

    wrap.appendChild(card);
  });
}

/* ---------- Tabs ---------- */
function switchTab(name, silent = false) {
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("is-active", p.id === "panel-" + name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (!silent) playSound("tap");
}

/* ---------- Settings ---------- */
function applySettings() {
  $("#testingBanner").classList.toggle("is-shown", settings.testing);
  $("#settingSound").checked        = settings.sound;
  $("#settingTesting").checked      = settings.testing;
  $("#settingAutoSurprise").checked = settings.autoSurprise;
}

function initSettings() {
  const overlay = $("#settingsOverlay");

  $("#settingsBtn").addEventListener("click", () => {
    playSound("tap");
    overlay.classList.add("is-open");
  });
  $("#settingsClose").addEventListener("click", () => {
    overlay.classList.remove("is-open");
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("is-open");
  });

  $("#settingSound").addEventListener("change", (e) => {
    settings.sound = e.target.checked;
    saveSettings();
    if (settings.sound) playSound("tap");
  });
  $("#settingTesting").addEventListener("change", (e) => {
    settings.testing = e.target.checked;
    saveSettings();
    playSound("tap");
    applySettings();
  });
  $("#settingAutoSurprise").addEventListener("change", (e) => {
    settings.autoSurprise = e.target.checked;
    saveSettings();
    playSound("tap");
  });

  applySettings();
}

/* ---------- Init ---------- */
function init() {
  buildMenu();
  buildDots("strength", STRENGTH_LABELS, "strength");
  buildDots("size", DOT_LABELS, "size");
  buildClients();
  updateSummary();
  render();

  $("#addBtn").addEventListener("click", addOrder);
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  initSettings();
}

init();

/* ---------- Wake Lock — keep screen on while app is visible ---------- */
let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  if (wakeLock !== null) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
});
document.addEventListener("touchstart", requestWakeLock, { once: true });
document.addEventListener("click",      requestWakeLock, { once: true });
