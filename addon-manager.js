// ── Addon Manager ───────────────────────────────────────────────────────────
// Loads, manages, and isolates addons from ./addons/{name}.js
//
// Each addon exports default: { name, version, description?, author?, icon?, init(ctx) }
//
// Icon values: any Material Symbols name  OR  a Font Awesome class string ("fa-solid fa-star").
//
// Context API (ctx.*):
//   DOM injection  : injectCSS, injectHTML, injectPanel, addToolbarBtn
//   Settings       : addSettingsSection, addSettingsRow, addSettingsToggle, addSettingsInput, addSettingsButton
//   Modals         : createModal, openModal, closeModal
//   Notifications  : toast(msg, type?, duration?)
//   Storage        : storage.get / set / remove / all
//   Events         : on, emit
//   Clock          : onTick
//   Utilities      : utils
//   Cleanup        : onUnload(funct)

const ADDON_DIR    = './addons/';
const KEY_LIST     = 'addons';
const KEY_DISABLED = 'addons_disabled';

/* ── Icon helpers ───────────────────────────────────────── */
const isFa = icon => typeof icon === 'string' && icon.includes('fa-');

const iconHtml = (icon = 'extension', size = 20) => isFa(icon)
  ? `<index class="${icon}" style="font-size:${size}size"></index>`
  : `<span class="material-symbols-outlined" style="font-size:${size}size">${icon}</span>`;

/* ── Shared event bus ───────────────────────────────────── */
const bus = new EventTarget();


/* ══════════════════════════════════════════════════════════
   Addon Manager
   ══════════════════════════════════════════════════════════ */
export class AddonManager {
  constructor(state, utils, modals) {
    this.state  = state;
    this.utils  = utils;
    this.modals = modals;
    this.loaded = new Map(); // name -> { meta, cleanups, scopeId }
  }

  /* ── Persistence ────────────────────────────────────── */
  getList()          { return this.utils.load(KEY_LIST, []);     }
  saveList(list)     { this.utils.save(KEY_LIST,     list);      }
  getDisabled()      { return this.utils.load(KEY_DISABLED, []); }
  saveDisabled(list) { this.utils.save(KEY_DISABLED, list);      }

  /* ── Context factory ────────────────────────────────── */
  buildCtx(addonName) {
    const scope    = `addon-${addonName}`;
    const utils    = this.utils;
    const mm       = this.modals;
    const cleanups = [];
    const onUnload = funct => cleanups.push(funct);

    /* DOM ------------------------------------------------ */
    const injectCSS = css => {
      const id = `${scope}-style`;
      document.getElementById(id)?.remove();
      const tag = Object.assign(document.createElement('style'), { id, textContent: css });
      document.head.appendChild(tag);
    };

    // slot: 'before-search' | 'after-search' | 'after-shortcuts' | 'top-bar' | 'body'
    const injectHTML = (slot, html) => {
      const id = `${scope}-html-${slot}`;
      document.getElementById(id)?.remove();

      const wrap = Object.assign(document.createElement('div'), { id, innerHTML: html });

      const insert = {
        'before-search'   : () => document.querySelector('.app-container').insertBefore(wrap, document.querySelector('.search-card')),
        'after-search'    : () => document.querySelector('.search-card').insertAdjacentElement('afterend', wrap),
        'after-shortcuts' : () => document.getElementById('shortcutsContainer').insertAdjacentElement('afterend', wrap),
        'top-bar'         : () => document.querySelector('.top-bar').appendChild(wrap),
        'body'            : () => document.body.appendChild(wrap),
      };

      insert[slot]?.();
      onUnload(() => document.getElementById(id)?.remove());
      return wrap;
    };

    const injectPanel = (opts = {}) => {
      const { id = `${scope}-panel`, className = '' } = opts;
      document.getElementById(id)?.remove();

      const panel = Object.assign(document.createElement('div'), {
        id,
        className : `addon-panel ${className}`.trim(),
      });

      document.getElementById('shortcutsContainer').insertAdjacentElement('afterend', panel);
      onUnload(() => document.getElementById(id)?.remove());
      return panel;
    };

    const addToolbarBtn = (opts = {}) => {
      const { icon = 'extension', label = addonName, onClick } = opts;
      const button = document.createElement('button');
      button.className = 'icon-btn addon-toolbar-button';
      button.setAttribute('aria-label', label);
      button.setAttribute('data-addon-button', addonName);
      button.innerHTML = iconHtml(icon, 22);
      if (onClick) button.addEventListener('click', onClick);
      document.querySelector('.top-bar').prepend(button);
      onUnload(() => button.remove());
      return button;
    };

    /* Settings ------------------------------------------ */
    const addSettingsSection = title => {
      const id    = `${scope}-settings-${title.replace(/\s+/g, '-').toLowerCase()}`;
      const root  = document.querySelector('#settingsModal .modal-content');
      let section = document.getElementById(id);

      if (!section) {
        section = Object.assign(document.createElement('div'), {
          id,
          className : 'settings-section',
          innerHTML : `<label class="settings-label">${title}</label>`,
        });
        root.appendChild(section);
        onUnload(() => document.getElementById(id)?.remove());
      }

      return section;
    };

    const addSettingsRow = (section, rowLabel, controlHtml) => {
      const row = Object.assign(document.createElement('div'), {
        className : 'settings-row',
        innerHTML : `<label>${rowLabel}</label><div>${controlHtml}</div>`,
      });
      section.appendChild(row);
      return row;
    };

    const addSettingsToggle = (section, label, storageKey, defaultVal = false, onChange) => {
      const inputId = `${scope}-toggle-${storageKey}`;
      const saved   = utils.load(`${scope}:${storageKey}`, defaultVal);
      const row     = addSettingsRow(section, label, `
        <label class="toggle">
          <input type="checkbox" id="${inputId}" ${saved ? 'checked' : ''}>
          <span class="track"></span>
        </label>
      `);
      const input = document.getElementById(inputId);
      input?.addEventListener('change', event => {
        utils.save(`${scope}:${storageKey}`, event.target.checked);
        onChange?.(event.target.checked);
      });
      return { row, input };
    };

    const addSettingsInput = (section, label, storageKey, placeholder = '', onChange) => {
      const inputId = `${scope}-input-${storageKey}`;
      const saved   = utils.load(`${scope}:${storageKey}`, '');
      const row     = addSettingsRow(section, label, `
        <input type="text" id="${inputId}" class="modal-input" placeholder="${placeholder}" value="${saved}">
      `);
      const input = document.getElementById(inputId);
      input?.addEventListener('change', event => {
        utils.save(`${scope}:${storageKey}`, event.target.value);
        onChange?.(event.target.value);
      });
      return { row, input };
    };

    const addSettingsButton = (section, label, btnText, onClick) => {
      const row = Object.assign(document.createElement('div'), {
        className : 'settings-row',
        innerHTML : `
          <label>${label}</label>
          <button class="btn-primary" style="height:32px;padding:0 12px;font-size:0.85rem">${btnText}</button>
        `,
      });
      row.querySelector('button').addEventListener('click', onClick);
      section.appendChild(row);
      return row;
    };

    /* Modals -------------------------------------------- */
    const createModal = (name, contentHtml, opts = {}) => {
      const fullName = `${scope}-modal-${name}`;
      let   element  = document.querySelector(`[data-modal="${fullName}"]`);

      if (!element) {
        const large = opts.size === 'large' ? 'modal-lg' : '';
        element = Object.assign(document.createElement('div'), {
          id        : fullName,
          className : 'modal hidden',
          innerHTML : `<div class="modal-content glass-card ${large}">${contentHtml}</div>`,
        });
        element.setAttribute('data-modal', fullName);
        document.body.appendChild(element);
        element.addEventListener('click', event => { if (event.target === element) mm.close(fullName); });
        onUnload(() => { mm.close(fullName); element.remove(); });
      }

      return { element, open: () => mm.open(fullName), close: () => mm.close(fullName) };
    };

    /* Notifications ------------------------------------- */
    const toast = (msg, type = 'info', dur = 3000) => ToastManager.show(msg, type, dur);

    /* Storage ------------------------------------------- */
    const storage = {
      get    : key           => utils.load(`${scope}:${key}`, null),
      set    : (key, value ) => utils.save(`${scope}:${key}`, value),
      remove : key           => localStorage.removeItem(`${scope}:${key}`),
      all    : ()            => {
        const prefix = `${scope}:`;
        const out    = {};
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith(prefix)) {
            try   { out[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key)); }
            catch { out[key.slice(prefix.length)] = localStorage.getItem(key); }
          }
        }
        return out;
      },
    };

    /* Events -------------------------------------------- */
    const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(`addon:${name}`, { detail }));

    const on = (name, cb) => {
      const handler = event => cb(event.detail);
      bus.addEventListener(`addon:${name}`, handler);
      onUnload(() => bus.removeEventListener(`addon:${name}`, handler));
      return () => bus.removeEventListener(`addon:${name}`, handler);
    };

    /* Clock --------------------------------------------- */
    const onTick = cb => {
      const handler = event => cb(event.detail);
      document.addEventListener('startpage:tick', handler);
      onUnload(() => document.removeEventListener('startpage:tick', handler));
    };

    return {
      name    : addonName,
      scopeId : scope,
      // DOM
      injectCSS,
      injectHTML,
      injectPanel,
      addToolbarBtn,
      // Settings
      addSettingsSection,
      addSettingsRow,
      addSettingsToggle,
      addSettingsInput,
      addSettingsButton,
      // Modals
      createModal,
      openModal  : name => mm.open(`${scope}-modal-${name}`),
      closeModal : name => mm.close(`${scope}-modal-${name}`),
      // Notifications
      toast,
      // Storage
      storage,
      // Events
      emit,
      on,
      // Clock
      onTick,
      // Utils
      utils,
      // Cleanup
      onUnload,
      // Internal — drained by unload()
      cleanups,
    };
  }

  /* ── Load / unload ──────────────────────────────────── */
  async load(name) {
    if (this.loaded.has(name)) return;

    const isUrl = name.startsWith('http://') || name.startsWith('https://');
    const url   = isUrl ? name : `${ADDON_DIR}${name}.js`;

    try {
      const mod   = await import(url);
      const addon = mod.default;

      if (typeof addon?.init !== 'function') {
        throw new Error('Addon must export default { name, version, init }');
      }

      const ctx     = this.buildCtx(name);
      const cleanup = await addon.init(ctx);
      if (typeof cleanup === 'function') ctx.cleanups.push(cleanup);

      this.loaded.set(name, {
        meta : {
          name        : addon.name        ?? name,
          version     : addon.version     ?? '?',
          description : addon.description ?? '',
          author      : addon.author      ?? '',
          icon        : addon.icon        ?? 'extension',
        },
        cleanups : ctx.cleanups,
        scopeId  : ctx.scopeId,
      });

      console.info(`[AddonManager] Loaded "${name}" v${addon.version ?? '?'}`);

    } catch (err) {
      console.error(`[AddonManager] Failed to load "${name}":`, err);
      ToastManager.show(`Failed to load addon "${name}"`, 'error');
    }
  }

  unload(name) {
    const entry = this.loaded.get(name);
    if (!entry) return;

    for (const funct of entry.cleanups) {
      try { funct(); } catch (err) { console.warn(`[AddonManager] Cleanup error for "${name}":`, err); }
    }

    document.querySelectorAll(`[id^="${entry.scopeId}"]`).forEach(element => element.remove());
    document.querySelectorAll(`[data-addon-button="${CSS.escape(name)}"]`).forEach(element => element.remove());

    this.loaded.delete(name);
    console.info(`[AddonManager] Unloaded "${name}"`);
  }

  async loadAll() {
    const disabled = this.getDisabled();
    await Promise.all(
      this.getList()
        .filter(name => !disabled.includes(name))
        .map(name => this.load(name))
    );
  }

  /* ── Install / remove ───────────────────────────────── */
  install(name) {
    const list = this.getList();
    if (list.includes(name)) {
      ToastManager.show(`"${name}" is already installed`, 'warning');
      return;
    }

    list.push(name);
    this.saveList(list);

    const disabled = this.getDisabled();
    const di       = disabled.indexOf(name);
    if (di > -1) {
      disabled.splice(di, 1);
      this.saveDisabled(disabled);
    }

    this.load(name).then(() => this.drawList());
  }

  remove(name) {
    this.unload(name);
    this.saveList(this.getList().filter(n => n !== name));
    this.saveDisabled(this.getDisabled().filter(n => n !== name));
    this.drawList();
    ToastManager.show(`Removed "${name}"`, 'info');
  }

  toggleEnable(name) {
    const disabled = this.getDisabled();
    const idx      = disabled.indexOf(name);

    if (idx > -1) {
      disabled.splice(idx, 1);
      this.saveDisabled(disabled);
      this.load(name).then(() => this.drawList());
      ToastManager.show(`Enabled "${name}"`, 'success');
    } else {
      disabled.push(name);
      this.saveDisabled(disabled);
      this.unload(name);
      this.drawList();
      ToastManager.show(`Disabled "${name}"`, 'info');
    }
  }

  /* ── Modal UI ───────────────────────────────────────── */
  openModal() {
    if (!document.getElementById('addonsModal')) this.createModal();
    this.drawList();
    this.modals.open('addons');
  }

  createModal() {
    const modal = Object.assign(document.createElement('div'), {
      id        : 'addonsModal',
      className : 'modal hidden',
      innerHTML : `
        <div class="modal-content glass-card modal-lg">
          <h3>Addons</h3>
          <div id="addonList" class="addon-list"></div>
          <div class="form-section">
            <h4>Install by name or URL</h4>
            <input type="text" id="addonInput" class="modal-input" placeholder="addon-name or https://…">
            <button id="addonInstallBtn" class="btn-primary full-width" style="margin-top:10px">Install</button>
          </div>
        </div>
      `,
    });
    modal.setAttribute('data-modal', 'addons');
    document.body.appendChild(modal);

    modal.addEventListener('click', event => { if (event.target === modal) this.modals.close('addons'); });

    document.getElementById('addonInstallBtn').addEventListener('click', () => {
      const input = document.getElementById('addonInput');
      const name  = input.value.trim();
      if (!name) return;
      this.install(name);
      input.value = '';
    });
  }

  drawList() {
    const container = document.getElementById('addonList');
    if (!container) return;

    const list     = this.getList();
    const disabled = this.getDisabled();

    if (!list.length) {
      container.innerHTML = `<p class="addon-empty">No addons installed.</p>`;
      return;
    }

    container.innerHTML = list.map(name => {
      const entry      = this.loaded.get(name);
      const meta       = entry?.meta;
      const isDisabled = disabled.includes(name);

      const versionHtml = meta?.version
        ? `<span class="addon-version">v${meta.version}</span>` : '';
      const authorHtml  = meta?.author
        ? `<span class="addon-author" title="Author: ${meta.author}">${meta.author}</span>` : '';
      const descHtml    = meta?.description
        ? `<span class="addon-desc" title="${meta.description}">${meta.description}</span>` : '';

      const statusHtml = isDisabled
        ? `<span class="addon-status off">disabled</span>`
        : entry
          ? `<span class="addon-status ok">active</span>`
          : `<span class="addon-status err">failed</span>`;

      const safeName = name.replace(/"/g, '&quot;');

      return `
        <div class="addon-item${isDisabled ? ' is-disabled' : ''}">
          <div class="addon-info">
            <div class="addon-icon clickable" data-toggle="${safeName}" title="Toggle enable/disable">
              ${iconHtml(meta?.icon ?? 'extension', 20)}
            </div>
            <div class="addon-text">
              <div class="addon-name-row">
                <span class="addon-name">${meta?.name ?? name}</span>
                ${versionHtml}
                ${authorHtml}
              </div>
              ${descHtml}
            </div>
          </div>
          <div class="addon-actions">
            ${statusHtml}
            <button class="action-btn delete-btn" data-remove="${safeName}" aria-label="Remove" title="Uninstall">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-toggle]').forEach(button =>
      button.addEventListener('click', () => this.toggleEnable(button.dataset.toggle))
    );
    container.querySelectorAll('[data-remove]').forEach(button =>
      button.addEventListener('click', () => this.remove(button.dataset.remove))
    );
  }
}


/* ══════════════════════════════════════════════════════════
   Toast Manager
   ══════════════════════════════════════════════════════════ */
export class ToastManager {
  static container = null;

  static getContainer() {
    if (!ToastManager.container) {
      ToastManager.container = Object.assign(document.createElement('div'), {
        id        : 'toastContainer',
        className : 'toast-container',
      });
      document.body.appendChild(ToastManager.container);
    }
    return ToastManager.container;
  }

  static show(message, type = 'info', duration = 3000) {
    const container = ToastManager.getContainer();

    const toast = Object.assign(document.createElement('div'), {
      className : `toast ${type}`,
      innerHTML : `
        <span class="toast-icon material-symbols-outlined">${ToastManager.icon(type)}</span>
        <span class="toast-msg">${message}</span>
      `,
    });

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const dismiss = () => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };

    const timer = setTimeout(dismiss, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  }

  static icon(type) {
    return { info: 'info', success: 'check_circle', error: 'error', warning: 'warning' }[type] ?? 'info';
  }
}