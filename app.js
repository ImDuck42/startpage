import { AddonManager, ToastManager } from './addon-manager.js';

/* ── Storage keys ───────────────────────────────────────── */
const KEYS = {
  shortcuts : 'shortcuts',
  engines   : 'engines',
  prefs     : 'prefs',
  bg        : 'bg',
};

/* ── Defaults ───────────────────────────────────────────── */
const DEFAULTS = {
  shortcuts : [
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'Reddit',  url: 'https://reddit.com'  },
    { name: 'GitHub',  url: 'https://github.com'  },
  ],
  engines : [
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s'      },
    { name: 'Bing',       url: 'https://www.bing.com/search?q=%s'  },
  ],
  prefs : { showSec: false, use24: true, engIdx: 0, newTab: false },
  bg    : { type: 'grad', val: '' },
};

/* ── Utilities ──────────────────────────────────────────── */
const utils = {
  favicon(url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
    } catch {
      return 'https://www.google.com/s2/favicons?domain=google.com';
    }
  },

  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },

  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  validUrl(str) {
    try { new URL(str); return true; }
    catch { return false; }
  },

  // Alias shape expected by AddonManager (getStorageData / saveStorage)
  getStorageData : (key, fb) => utils.load(key, fb),
  saveStorage    : (key, data) => utils.save(key, data),
};

/* ── DOM references ─────────────────────────────────────── */
const el = {
  time     : document.getElementById('timeDisplay'),
  greeting : document.getElementById('greeting'),
  grid     : document.getElementById('shortcutsContainer'),
  search   : document.getElementById('searchInput'),
  engIcon  : document.getElementById('engineIcon'),
  bgWrap   : document.getElementById('bgOverlay'),
  modals   : document.querySelectorAll('.modal'),

  // shortcut modal
  scModal  : document.getElementById('shortcutModal'),
  scTitle  : document.getElementById('shortcutModalTitle'),
  scName   : document.getElementById('shortcutName'),
  scUrl    : document.getElementById('shortcutUrl'),
  scIdx    : document.getElementById('shortcutEditIdx'),
  scSave   : document.getElementById('shortcutSaveBtn'),
  scDelete : document.getElementById('shortcutDeleteBtn'),

  // engine modal
  engModal  : document.getElementById('engineModal'),
  engList   : document.getElementById('engineList'),
  engName   : document.getElementById('engineName'),
  engUrl    : document.getElementById('engineUrl'),
  engIdx    : document.getElementById('engineEditIdx'),
  engTitle  : document.getElementById('engineFormTitle'),
  engSave   : document.getElementById('engineSaveBtn'),

  // settings modal
  settingsModal : document.getElementById('settingsModal'),
  showSec       : document.getElementById('settingShowSec'),
  use24         : document.getElementById('setting24hr'),
  newTab        : document.getElementById('settingNewTab'),
  bgUrl         : document.getElementById('bgUrlInput'),
  bgFile        : document.getElementById('bgFileInput'),
  resetBg       : document.getElementById('resetBgBtn'),

  // toolbar
  settingsBtn : document.getElementById('settingsBtn'),
  addonBtn    : document.getElementById('addonBtn'),
  engBtn      : document.getElementById('engineBtn'),
  goBtn       : document.getElementById('searchGoBtn'),
};

/* ── State ──────────────────────────────────────────────── */
const state = {
  shortcuts    : utils.load(KEYS.shortcuts, DEFAULTS.shortcuts),
  engines      : utils.load(KEYS.engines,   DEFAULTS.engines),
  prefs        : utils.load(KEYS.prefs,     DEFAULTS.prefs),
  bg           : utils.load(KEYS.bg,        DEFAULTS.bg),
  editMode     : false,
  pressTimer   : null,

  persist() {
    utils.save(KEYS.shortcuts, this.shortcuts);
    utils.save(KEYS.engines,   this.engines);
    utils.save(KEYS.prefs,     this.prefs);
    utils.save(KEYS.bg,        this.bg);
  },

  enterEdit() {
    this.editMode = true;
    document.body.classList.add('edit-mode');
    navigator.vibrate?.(50);
  },

  exitEdit() {
    this.editMode = false;
    document.body.classList.remove('edit-mode');
  },
};

/* ── Modal manager ──────────────────────────────────────── */
const modals = {
  open(name) {
    document.querySelector(`.modal[data-modal="${name}"]`)?.classList.remove('hidden');
  },
  close(name) {
    document.querySelector(`.modal[data-modal="${name}"]`)?.classList.add('hidden');
  },
  initBackdropClose() {
    el.modals.forEach(modal =>
      modal.addEventListener('click', evt => {
        if (evt.target === modal) this.close(modal.dataset.modal);
      })
    );
  },
};

/* ── Clock ──────────────────────────────────────────────── */
const clock = {
  start() {
    this.tick();
    setInterval(() => this.tick(), 1000);
  },

  tick() {
    const now = new Date();
    el.greeting.textContent = this.greeting(now.getHours());
    el.time.textContent     = this.format(now);
    document.dispatchEvent(new CustomEvent('startpage:tick', { detail: now }));
  },

  greeting(hour) {
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  },

  format(date) {
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');

    let hours  = date.getHours();
    let suffix = '';

    if (!state.prefs.use24) {
      suffix = hours >= 12 ? ' PM' : ' AM';
      hours  = hours % 12 || 12;
    } else {
      hours = String(hours).padStart(2, '0');
    }

    return `${hours}:${mins}${state.prefs.showSec ? `:${secs}` : ''}${suffix}`;
  },
};

/* ── Wallpaper ──────────────────────────────────────────── */
const wallpaper = {
  init() {
    el.bgUrl.addEventListener('input', () => this.fromUrl());
    el.bgFile.addEventListener('change', evt => this.fromFile(evt));
    el.resetBg.addEventListener('click', () => this.reset());
  },

  fromUrl() {
    const url = el.bgUrl.value.trim();
    if (url && utils.validUrl(url)) {
      state.bg = { type: 'url', val: url };
      state.persist();
      this.apply();
    }
  },

  fromFile(evt) {
    const file = evt.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 4_500_000)           { alert('Image too large (max 4.5 MB).'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      state.bg = { type: 'file', val: reader.result };
      state.persist();
      this.apply();
    };
    reader.readAsDataURL(file);
  },

  apply() {
    const { type, val } = state.bg;
    el.bgWrap.style.background = (type === 'url' || type === 'file') && val
      ? `url('${val}') center / cover no-repeat`
      : '';
  },

  reset() {
    state.bg = { type: 'grad', val: '' };
    state.persist();
    this.apply();
    el.bgUrl.value  = '';
    el.bgFile.value = '';
  },
};

/* ── Shortcuts ──────────────────────────────────────────── */
const shortcuts = {
  init() {
    el.scSave.addEventListener('click',   () => this.save());
    el.scDelete.addEventListener('click', () => this.remove());
  },

  draw() {
    el.grid.innerHTML = '';
    state.shortcuts.forEach((sc, idx) => el.grid.appendChild(this.tile(sc, idx)));
    el.grid.appendChild(this.addTile());
  },

  tile(sc, idx) {
    const div = document.createElement('div');
    div.className = 'shortcut';
    div.title     = `${sc.name} (${sc.url})`;
    div.innerHTML = `
      <div class="shortcut-icon">
        <img src="${utils.favicon(sc.url)}" loading="lazy" alt="${sc.name}">
      </div>
      <span class="shortcut-label">${sc.name}</span>
    `;
    this.bindTile(div, idx);
    return div;
  },

  addTile() {
    const div = document.createElement('div');
    div.className = 'shortcut';
    div.title     = 'Add a new shortcut';
    div.innerHTML = `
      <div class="shortcut-icon">
        <span class="material-symbols-outlined" style="font-size:1.4rem">add</span>
      </div>
      <span class="shortcut-label">Add</span>
    `;
    div.addEventListener('click', () => this.openModal(-1));
    return div;
  },

  bindTile(div, idx) {
    const startPress = () => {
      if (state.editMode) return;
      state.pressTimer = setTimeout(() => {
        state.enterEdit();
        this.listenForEditExit();
      }, 800);
    };
    const cancelPress = () => clearTimeout(state.pressTimer);
    const onClick = evt => {
      if (state.editMode) {
        evt.preventDefault();
        this.openModal(idx);
      } else {
        evt.preventDefault();
        this.navigate(state.shortcuts[idx].url);
      }
    };

    div.addEventListener('touchstart', startPress,   { passive: true });
    div.addEventListener('touchend',   cancelPress);
    div.addEventListener('mousedown',  startPress);
    div.addEventListener('mouseup',    cancelPress);
    div.addEventListener('mouseleave', cancelPress);
    div.addEventListener('click',      onClick);
  },

  listenForEditExit() {
    const handler = evt => {
      if (!evt.target.closest('.shortcut') && !evt.target.closest('.modal')) {
        state.exitEdit();
        document.removeEventListener('click', handler);
      }
    };
    setTimeout(() => document.addEventListener('click', handler), 100);
  },

  navigate(url) {
    if (state.prefs.newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else                    window.location.href = url;
  },

  openModal(idx) {
    el.scIdx.value = idx;

    if (idx > -1) {
      el.scName.value        = state.shortcuts[idx].name;
      el.scUrl.value         = state.shortcuts[idx].url;
      el.scTitle.textContent = 'Edit Shortcut';
      el.scDelete.classList.remove('hidden');
    } else {
      el.scName.value        = '';
      el.scUrl.value         = '';
      el.scTitle.textContent = 'Add Shortcut';
      el.scDelete.classList.add('hidden');
    }

    modals.open('shortcut');
  },

  save() {
    const name = el.scName.value.trim();
    const url  = el.scUrl.value.trim();
    if (!name || !url) return;

    const idx  = parseInt(el.scIdx.value);
    const item = { name, url: utils.validUrl(url) ? url : `https://${url}` };

    if (idx > -1) state.shortcuts[idx] = item;
    else          state.shortcuts.push(item);

    state.persist();
    this.draw();
    modals.close('shortcut');
  },

  remove() {
    state.shortcuts.splice(parseInt(el.scIdx.value), 1);
    state.persist();
    this.draw();
    modals.close('shortcut');
  },
};

/* ── Search engines ─────────────────────────────────────── */
const engines = {
  init() {
    el.engBtn.addEventListener('click',   () => this.openModal());
    el.engSave.addEventListener('click',  () => this.save());
    el.goBtn.addEventListener('click',    () => this.search());
    el.search.addEventListener('keydown', evt => { if (evt.key === 'Enter') this.search(); });
  },

  current() {
    return state.engines[state.prefs.engIdx] ?? state.engines[0];
  },

  syncIcon() {
    const eng = this.current();
    el.engIcon.src   = utils.favicon(eng.url);
    el.engBtn.title  = `Active: ${eng.name}. Click to change.`;
  },

  search() {
    const query = el.search.value.trim();
    if (!query) return;

    const eng = this.current();
    const url = eng.url.includes('%s')
      ? eng.url.replace('%s', encodeURIComponent(query))
      : eng.url + encodeURIComponent(query);

    if (state.prefs.newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else                    window.location.href = url;
  },

  openModal() {
    this.drawList();
    this.resetForm();
    modals.open('engine');
  },

  resetForm() {
    el.engIdx.value        = '-1';
    el.engName.value       = '';
    el.engUrl.value        = '';
    el.engTitle.textContent = 'Add New Engine';
    el.engSave.textContent  = 'Add Engine';
  },

  drawList() {
    el.engList.innerHTML = '';

    state.engines.forEach((eng, idx) => {
      const item = document.createElement('div');
      item.className = `engine-item${idx === state.prefs.engIdx ? ' active' : ''}`;
      item.title     = `${eng.name} — click to set active`;
      item.innerHTML = `
        <div class="engine-info">
          <img src="${utils.favicon(eng.url)}" alt="${eng.name}">
          <span class="engine-name">${eng.name}</span>
        </div>
        <div class="engine-actions">
          <button class="action-btn edit-btn" aria-label="Edit" title="Edit engine">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="action-btn delete-btn" aria-label="Delete" title="Remove engine">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;

      item.addEventListener('click', evt => {
        if (evt.target.closest('.action-btn')) return;
        state.prefs.engIdx = idx;
        state.persist();
        this.syncIcon();
        this.drawList();
        modals.close('engine');
        el.search.focus();
      });

      item.querySelector('.edit-btn').addEventListener('click', () => {
        el.engIdx.value         = idx;
        el.engName.value        = eng.name;
        el.engUrl.value         = eng.url;
        el.engTitle.textContent = 'Edit Engine';
        el.engSave.textContent  = 'Save Changes';
      });

      item.querySelector('.delete-btn').addEventListener('click', () => {
        if (state.engines.length <= 1) return;
        state.engines.splice(idx, 1);
        if (state.prefs.engIdx >= idx) state.prefs.engIdx = 0;
        state.persist();
        this.syncIcon();
        this.drawList();
        this.resetForm();
      });

      el.engList.appendChild(item);
    });
  },

  save() {
    const name = el.engName.value.trim();
    const url  = el.engUrl.value.trim();
    if (!name || !url) return;

    const idx = parseInt(el.engIdx.value);
    if (idx > -1) state.engines[idx] = { name, url };
    else          state.engines.push({ name, url });

    state.persist();
    this.syncIcon();
    this.drawList();
    this.resetForm();
  },
};

/* ── Settings ───────────────────────────────────────────── */
const settings = {
  init() {
    el.settingsBtn.addEventListener('click', () => this.open());

    el.showSec.addEventListener('change', evt => {
      state.prefs.showSec = evt.target.checked;
      state.persist();
      clock.tick();
    });
    el.use24.addEventListener('change', evt => {
      state.prefs.use24 = evt.target.checked;
      state.persist();
      clock.tick();
    });
    el.newTab.addEventListener('change', evt => {
      state.prefs.newTab = evt.target.checked;
      state.persist();
    });
  },

  open() {
    el.showSec.checked = state.prefs.showSec;
    el.use24.checked   = state.prefs.use24;
    el.newTab.checked  = state.prefs.newTab ?? false;
    modals.open('settings');
  },
};

/* ── Boot ───────────────────────────────────────────────── */
const addonMgr = new AddonManager(state, utils, modals);

document.addEventListener('contextmenu', evt => {
  if (evt.target.tagName !== 'INPUT') evt.preventDefault();
});

document.addEventListener('addon:install-addon', evt => addonMgr.install(evt.detail));
el.addonBtn.addEventListener('click', () => addonMgr.openModal());

modals.initBackdropClose();

wallpaper.init();
wallpaper.apply();

shortcuts.init();
shortcuts.draw();

engines.init();
engines.syncIcon();

settings.init();

clock.start();
addonMgr.loadAll();