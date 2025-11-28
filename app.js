// ========== STORAGE KEYS ==========
const STORAGE_KEYS = {
    SHORTCUTS: 'shortcuts',
    ENGINES: 'engines',
    PREFS: 'prefs',
    BG: 'bg'
};

// ========== DEFAULTS ==========
const DEFAULTS = {
    shortcuts: [
        { name: 'YouTube', url: 'https://youtube.com' },
        { name: 'Reddit', url: 'https://reddit.com' },
        { name: 'GitHub', url: 'https://github.com' }
    ],
    engines: [
        { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
        { name: 'Bing', url: 'https://www.bing.com/search?q=%s' }
    ],
    prefs: { showSec: false, use24: true, engIdx: 0 },
    bg: { type: 'grad', val: '' }
};

// ========== UTILITY FUNCTIONS ==========
const Utils = {
    getFavicon(url) {
        try {
            const hostname = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
        } catch {
            return 'https://www.google.com/s2/favicons?domain=google.com';
        }
    },

    getStorageData(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch {
            return fallback;
        }
    },

    saveStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }
};

// ========== DOM SELECTOR HELPER ==========
const DOM = {
    timeDisplay: document.getElementById('timeDisplay'),
    greeting: document.getElementById('greeting'),
    shortcutsContainer: document.getElementById('shortcutsContainer'),
    searchInput: document.getElementById('searchInput'),
    engineIcon: document.getElementById('engineIcon'),
    bgOverlay: document.getElementById('bgOverlay'),
    modals: document.querySelectorAll('.modal'),
    
    // Shortcut Modal
    shortcutModal: document.getElementById('shortcutModal'),
    shortcutModalTitle: document.getElementById('shortcutModalTitle'),
    shortcutName: document.getElementById('shortcutName'),
    shortcutUrl: document.getElementById('shortcutUrl'),
    shortcutEditIndex: document.getElementById('shortcutEditIndex'),
    shortcutSaveBtn: document.getElementById('shortcutSaveBtn'),
    shortcutDeleteBtn: document.getElementById('shortcutDeleteBtn'),
    
    // Engine Modal
    engineModal: document.getElementById('engineModal'),
    engineList: document.getElementById('engineList'),
    engineName: document.getElementById('engineName'),
    engineUrl: document.getElementById('engineUrl'),
    engineEditIndex: document.getElementById('engineEditIndex'),
    engineFormTitle: document.getElementById('engineFormTitle'),
    engineSaveBtn: document.getElementById('engineSaveBtn'),
    
    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    settingShowSeconds: document.getElementById('settingShowSeconds'),
    setting24Hour: document.getElementById('setting24Hour'),
    bgUrlInput: document.getElementById('bgUrlInput'),
    bgFileInput: document.getElementById('bgFileInput'),
    resetBgBtn: document.getElementById('resetBgBtn'),
    
    // Buttons
    settingsBtn: document.getElementById('settingsBtn'),
    engineBtn: document.getElementById('engineBtn'),
    searchGoBtn: document.getElementById('searchGoBtn')
};

// ========== STATE MANAGER ==========
class StateManager {
    constructor() {
        this.shortcuts = Utils.getStorageData(STORAGE_KEYS.SHORTCUTS, DEFAULTS.shortcuts);
        this.engines = Utils.getStorageData(STORAGE_KEYS.ENGINES, DEFAULTS.engines);
        this.prefs = Utils.getStorageData(STORAGE_KEYS.PREFS, DEFAULTS.prefs);
        this.bgData = Utils.getStorageData(STORAGE_KEYS.BG, DEFAULTS.bg);
        this.isEditMode = false;
        this.longPressTimer = null;
    }

    saveAll() {
        Utils.saveStorage(STORAGE_KEYS.SHORTCUTS, this.shortcuts);
        Utils.saveStorage(STORAGE_KEYS.ENGINES, this.engines);
        Utils.saveStorage(STORAGE_KEYS.PREFS, this.prefs);
        Utils.saveStorage(STORAGE_KEYS.BG, this.bgData);
    }

    enterEditMode() {
        this.isEditMode = true;
        document.body.classList.add('edit-mode');
        if (navigator.vibrate) navigator.vibrate(50);
    }

    exitEditMode() {
        this.isEditMode = false;
        document.body.classList.remove('edit-mode');
    }
}

const state = new StateManager();

// ========== CLOCK MODULE ==========
class ClockManager {
    constructor() {
        this.tick = this.tick.bind(this);
    }

    start() {
        this.tick();
        setInterval(this.tick, 1000);
    }

    tick() {
        const now = new Date();
        const greeting = this.getGreeting(now.getHours());
        const time = this.formatTime(now);
        
        DOM.greeting.innerText = greeting;
        DOM.timeDisplay.innerText = time;
    }

    getGreeting(hour) {
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    }

    formatTime(date) {
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        let suffix = '';
        if (!state.prefs.use24) {
            suffix = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12 || 12;
        } else {
            hours = String(hours).padStart(2, '0');
        }

        let time = `${hours}:${minutes}`;
        if (state.prefs.showSec) time += `:${seconds}`;
        
        return time + suffix;
    }
}

// ========== WALLPAPER MODULE ==========
class WallpaperManager {
    constructor() {
        this.attachListeners();
    }

    attachListeners() {
        DOM.bgUrlInput.addEventListener('input', () => this.handleUrlInput());
        DOM.bgFileInput.addEventListener('change', (e) => this.handleFileInput(e));
        DOM.resetBgBtn.addEventListener('click', () => this.reset());
    }

    handleUrlInput() {
        const url = DOM.bgUrlInput.value.trim();
        if (url && Utils.isValidUrl(url)) {
            state.bgData = { type: 'url', val: url };
            state.saveAll();
            this.apply();
        }
    }

    handleFileInput(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, etc).');
            return;
        }

        if (file.size > 4500000) {
            alert('Image too large (max 4.5MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            state.bgData = { type: 'file', val: reader.result };
            state.saveAll();
            this.apply();
        };
        reader.readAsDataURL(file);
    }

    apply() {
        if ((state.bgData.type === 'url' || state.bgData.type === 'file') && state.bgData.val) {
            DOM.bgOverlay.style.background = `url('${state.bgData.val}') center/cover no-repeat`;
        } else {
            DOM.bgOverlay.style.background = '';
        }
    }

    reset() {
        state.bgData = { type: 'grad', val: '' };
        state.saveAll();
        this.apply();
        DOM.bgUrlInput.value = '';
        DOM.bgFileInput.value = '';
    }
}

// ========== SHORTCUTS MODULE ==========
class ShortcutsManager {
    constructor() {
        this.attachListeners();
    }

    attachListeners() {
        DOM.shortcutSaveBtn.addEventListener('click', () => this.save());
        DOM.shortcutDeleteBtn.addEventListener('click', () => this.delete());
    }

    draw() {
        DOM.shortcutsContainer.innerHTML = '';

        state.shortcuts.forEach((shortcut, index) => {
            const element = this.createShortcutElement(shortcut, index);
            DOM.shortcutsContainer.appendChild(element);
        });

        // Add "Add" tile
        const addTile = this.createAddTile();
        DOM.shortcutsContainer.appendChild(addTile);
    }

    createShortcutElement(shortcut, index) {
        const div = document.createElement('div');
        div.className = 'shortcut';
        div.innerHTML = `
            <div class="shortcut-icon">
                <img src="${Utils.getFavicon(shortcut.url)}" loading="lazy" alt="${shortcut.name}">
            </div>
            <span class="shortcut-label">${shortcut.name}</span>
        `;

        const handlers = this.createEventHandlers(index);
        div.addEventListener('touchstart', handlers.hold, { passive: true });
        div.addEventListener('touchend', handlers.cancel);
        div.addEventListener('mousedown', handlers.hold);
        div.addEventListener('mouseup', handlers.cancel);
        div.addEventListener('mouseleave', handlers.cancel);
        div.addEventListener('click', handlers.click);

        return div;
    }

    createAddTile() {
        const div = document.createElement('div');
        div.className = 'shortcut add-shortcut';
        div.innerHTML = `
            <div class="shortcut-icon">
                <span class="material-symbols-outlined" style="font-size:1.4rem;">add</span>
            </div>
            <span class="shortcut-label">Add</span>
        `;
        div.addEventListener('click', () => this.openModal(-1));
        return div;
    }

    createEventHandlers(index) {
        return {
            hold: () => {
                if (state.isEditMode) return;
                state.longPressTimer = setTimeout(() => {
                    state.enterEditMode();
                    this.addOutsideClickListener();
                }, 800);
            },
            cancel: () => clearTimeout(state.longPressTimer),
            click: (e) => {
                if (state.isEditMode) {
                    e.preventDefault();
                    this.openModal(index);
                } else {
                    window.location.href = state.shortcuts[index].url;
                }
            }
        };
    }

    addOutsideClickListener() {
        const handler = (e) => {
            if (!e.target.closest('.shortcut') && !e.target.closest('.modal')) {
                state.exitEditMode();
                document.removeEventListener('click', handler);
            }
        };
        setTimeout(() => document.addEventListener('click', handler), 100);
    }

    openModal(index) {
        DOM.shortcutEditIndex.value = index;
        
        if (index > -1) {
            DOM.shortcutName.value = state.shortcuts[index].name;
            DOM.shortcutUrl.value = state.shortcuts[index].url;
            DOM.shortcutModalTitle.innerText = 'Edit Shortcut';
            DOM.shortcutDeleteBtn.classList.remove('hidden');
        } else {
            DOM.shortcutName.value = '';
            DOM.shortcutUrl.value = '';
            DOM.shortcutModalTitle.innerText = 'Add Shortcut';
            DOM.shortcutDeleteBtn.classList.add('hidden');
        }
        
        ModalManager.open('shortcut');
    }

    save() {
        const name = DOM.shortcutName.value.trim();
        const url = DOM.shortcutUrl.value.trim();
        
        if (!name || !url) return;

        const item = {
            name,
            url: Utils.isValidUrl(url) ? url : `https://${url}`
        };

        const index = parseInt(DOM.shortcutEditIndex.value);
        if (index > -1) {
            state.shortcuts[index] = item;
        } else {
            state.shortcuts.push(item);
        }

        state.saveAll();
        this.draw();
        ModalManager.close('shortcut');
    }

    delete() {
        const index = parseInt(DOM.shortcutEditIndex.value);
        state.shortcuts.splice(index, 1);
        state.saveAll();
        this.draw();
        ModalManager.close('shortcut');
    }
}

// ========== SEARCH ENGINE MODULE ==========
class SearchEngineManager {
    constructor() {
        this.attachListeners();
    }

    attachListeners() {
        DOM.engineBtn.addEventListener('click', () => this.openModal());
        DOM.engineSaveBtn.addEventListener('click', () => this.save());
        DOM.searchGoBtn.addEventListener('click', () => this.search());
        DOM.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.search();
        });
    }

    setCurrentEngine() {
        const engine = state.engines[state.prefs.engIdx] || state.engines[0];
        DOM.engineIcon.src = Utils.getFavicon(engine.url);
    }

    search() {
        const query = DOM.searchInput.value.trim();
        if (!query) return;

        const engine = state.engines[state.prefs.engIdx] || state.engines[0];
        const url = engine.url.includes('%s')
            ? engine.url.replace('%s', encodeURIComponent(query))
            : engine.url + encodeURIComponent(query);

        window.location.href = url;
    }

    openModal() {
        this.drawEngineList();
        this.resetForm();
        ModalManager.open('engine');
    }

    resetForm() {
        DOM.engineEditIndex.value = '-1';
        DOM.engineName.value = '';
        DOM.engineUrl.value = '';
        DOM.engineFormTitle.innerText = 'Add New Engine';
        DOM.engineSaveBtn.innerText = 'Add Engine';
    }

    drawEngineList() {
        DOM.engineList.innerHTML = '';

        state.engines.forEach((engine, index) => {
            const item = document.createElement('div');
            item.className = `engine-item ${index === state.prefs.engIdx ? 'active' : ''}`;

            item.innerHTML = `
                <div class="engine-info">
                    <img src="${Utils.getFavicon(engine.url)}" alt="${engine.name}">
                    <span class="engine-name">${engine.name}</span>
                </div>
                <div class="engine-actions">
                    <button class="action-btn edit-btn" aria-label="Edit">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="action-btn delete-btn" aria-label="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    state.prefs.engIdx = index;
                    state.saveAll();
                    this.setCurrentEngine();
                    ModalManager.close('engine');
                    DOM.searchInput.focus();
                    this.drawEngineList();
                }
            });

            item.querySelector('.edit-btn').addEventListener('click', () => {
                DOM.engineEditIndex.value = index;
                DOM.engineName.value = engine.name;
                DOM.engineUrl.value = engine.url;
                DOM.engineFormTitle.innerText = 'Edit Engine';
                DOM.engineSaveBtn.innerText = 'Save Changes';
            });

            item.querySelector('.delete-btn').addEventListener('click', () => {
                if (state.engines.length <= 1) {
                    alert('Keep at least one engine.');
                    return;
                }
                if (confirm(`Delete ${engine.name}?`)) {
                    state.engines.splice(index, 1);
                    if (state.prefs.engIdx >= index) state.prefs.engIdx = 0;
                    state.saveAll();
                    this.setCurrentEngine();
                    this.drawEngineList();
                    this.resetForm();
                }
            });

            DOM.engineList.appendChild(item);
        });
    }

    save() {
        const name = DOM.engineName.value.trim();
        const url = DOM.engineUrl.value.trim();

        if (!name || !url) return;

        const index = parseInt(DOM.engineEditIndex.value);
        if (index > -1) {
            state.engines[index] = { name, url };
        } else {
            state.engines.push({ name, url });
        }

        state.saveAll();
        this.setCurrentEngine();
        this.drawEngineList();
        this.resetForm();
    }
}

// ========== SETTINGS MODULE ==========
class SettingsManager {
    constructor() {
        this.attachListeners();
    }

    attachListeners() {
        DOM.settingsBtn.addEventListener('click', () => this.openModal());
        DOM.settingShowSeconds.addEventListener('change', (e) => {
            state.prefs.showSec = e.target.checked;
            state.saveAll();
            clock.tick();
        });
        DOM.setting24Hour.addEventListener('change', (e) => {
            state.prefs.use24 = e.target.checked;
            state.saveAll();
            clock.tick();
        });
    }

    openModal() {
        DOM.settingShowSeconds.checked = state.prefs.showSec;
        DOM.setting24Hour.checked = state.prefs.use24;
        ModalManager.open('settings');
    }
}

// ========== MODAL MANAGER ==========
class ModalManager {
    static open(name) {
        DOM.modals.forEach(m => {
            if (m.getAttribute('data-modal') === name) {
                m.classList.remove('hidden');
            }
        });
    }

    static close(name) {
        const modal = document.querySelector(`.modal[data-modal="${name}"]`);
        if (modal) modal.classList.add('hidden');
    }

    static initCloseOnOutsideClick() {
        DOM.modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close(modal.getAttribute('data-modal'));
                }
            });
        });
    }
}

// ========== GLOBAL EVENT LISTENERS ==========
function initGlobalListeners() {
    // Prevent context menu (except on inputs)
    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName !== 'INPUT') {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    ModalManager.initCloseOnOutsideClick();
}

// ========== INITIALIZATION ==========
const clock = new ClockManager();
const wallpaper = new WallpaperManager();
const shortcuts = new ShortcutsManager();
const searchEngine = new SearchEngineManager();
const settings = new SettingsManager();

function init() {
    initGlobalListeners();
    clock.start();
    wallpaper.apply();
    searchEngine.setCurrentEngine();
    shortcuts.draw();
}

init();