// ── Addon Template ──────────────────────────────────────────────────────────
// Copy to addons/my-addon.js and customise.
// The filename (without .js) becomes the addon's install ID.

export default {

  // ── Metadata ──────────────────────────────────────────────────────────────
  // name + version are required. Everything else is optional but recommended.
  name        : 'My Addon',
  version     : '1.0.0',
  description : 'A short description shown in the addon manager.',
  author      : 'your-name',

  // icon: any Material Symbols name  —  https://fonts.google.com/icons
  //       OR a Font Awesome class string: 'fa-solid fa-star', 'fab fa-github', …
  icon : 'extension',


  // ── init(ctx) ─────────────────────────────────────────────────────────────
  // Called once when the addon loads. ctx is your full API surface.
  // Register cleanup via ctx.onUnload(fn) or by returning a function.
  async init(ctx) {


    // ── CSS ───────────────────────────────────────────────────────────────
    // Inject a <style> tag. Re-calling replaces it. Auto-removed on unload.

    ctx.injectCSS(`
      .my-addon-box {
        padding    : 12px;
        background : rgba(255 255 255 / 0.05);
        border     : 1px solid rgba(255 255 255 / 0.1);
        border-radius : 12px;
        color      : #fff;
      }
    `);


    // ── HTML slots ────────────────────────────────────────────────────────
    // Inject HTML into a named slot. Returns the wrapper <div>.
    // Auto-removed on unload.
    //
    // Available slots:
    //   'before-search'   — above the search bar
    //   'after-search'    — below the search bar, above shortcuts
    //   'after-shortcuts' — below the shortcuts grid
    //   'top-bar'         — inside the top-right toolbar
    //   'body'            — appended to <body>

    const wrap = ctx.injectHTML('after-shortcuts', `
      <div class="my-addon-box">Hello from My Addon!</div>
    `);

    // wrap is the injected element — attach listeners, populate, etc.
    wrap.querySelector('.my-addon-box')?.addEventListener('click', () => {
      ctx.toast('Box clicked!', 'info');
    });


    // ── Panel ─────────────────────────────────────────────────────────────
    // A structured div injected below the shortcuts grid.
    // Equivalent to injectHTML('after-shortcuts', …) but gives you a
    // pre-styled .addon-panel container to work inside.
    // Auto-removed on unload.

    const panel = ctx.injectPanel({ className: 'my-panel' });
    panel.innerHTML = `<p style="margin:0;opacity:0.7">Panel content</p>`;


    // ── Toolbar button ────────────────────────────────────────────────────
    // Prepends an icon button to the top-right toolbar.
    // icon: Material Symbols name or FA class string.
    // Returns the <button> element. Auto-removed on unload.

    const toolbarBtn = ctx.addToolbarBtn({
      icon    : 'star',
      label   : 'My Addon',
      onClick : () => myModal.open(),
    });

    // You can style or mutate the button further:
    // toolbarBtn.style.color = 'gold';


    // ── Modal ─────────────────────────────────────────────────────────────
    // Creates a glass modal. Returns { element, open(), close() }.
    // name must be unique within your addon.
    // options: { size: 'large' }   — wider modal (default: normal)
    // Auto-removed on unload.

    const myModal = ctx.createModal('main', `
      <h3>My Addon</h3>
      <p style="opacity:0.7;margin:0">Modal content here.</p>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" id="my-addon-action">Do something</button>
        <button class="btn-danger"  id="my-addon-close">Close</button>
      </div>
    `);

    myModal.element.querySelector('#my-addon-action')?.addEventListener('click', () => {
      ctx.toast('Action triggered!', 'success');
    });

    myModal.element.querySelector('#my-addon-close')?.addEventListener('click', myModal.close);

    // Open/close programmatically:
    // myModal.open();
    // myModal.close();

    // Shorthand via ctx (uses scoped name automatically):
    // ctx.openModal('main');
    // ctx.closeModal('main');


// ── Settings section ──────────────────────────────────────────────────
    // Appends a section to the Settings modal.
    // All rows are auto-removed on unload.

    const section = ctx.addSettingsSection('My Addon');

    // Toggle — value auto-persisted under storageKey.
    // onChange(isOn) fires on every change.
    const featureToggle = ctx.addSettingsToggle(section, 'Enable feature', 'featureOn', false, isOn => {
      ctx.toast(`Feature ${isOn ? 'enabled' : 'disabled'}`, isOn ? 'success' : 'info');
    });

    // Text input — value auto-persisted under storageKey.
    // onChange(value) fires on blur/enter.
    const usernameInput = ctx.addSettingsInput(section, 'Username', 'username', 'Enter name…', val => {
      console.log('Username changed to', val);
    });

    // Raw row — supply any controlHTML string.
    // Returns the row element so you can attach listeners.
    const rawRow = ctx.addSettingsRow(section, 'Custom control', `
      <select class="modal-input" style="height:34px;padding:0 8px">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </select>
    `);
    rawRow.querySelector('select')?.addEventListener('change', evt => {
      console.log('Selected:', evt.target.value);
    });

    // Button row.
    ctx.addSettingsButton(section, 'Reset saved data', 'Reset', () => {
      // 1. Clear all namespace storage keys cleanly
      const allKeys = Object.keys(ctx.storage.all());
      allKeys.forEach(key => ctx.storage.remove(key));

      // 2. Programmatically reset visual state of input elements on the screen
      if (featureToggle.input) {
        featureToggle.input.checked = false;
      }
      if (usernameInput.input) {
        usernameInput.input.value = '';
      }

      ctx.toast('Data cleared', 'info');
    });

    // ── Storage ───────────────────────────────────────────────────────────
    // Namespaced key-value store. Keys are scoped to this addon automatically.
    // Values can be any JSON-serialisable type.

    const saved = ctx.storage.get('myData') ?? { count: 0 };
    saved.count++;
    ctx.storage.set('myData', saved);

    // ctx.storage.remove('myData');          — delete one key
    // const all = ctx.storage.all();         — { key: value, … } for all your keys


    // ── Toasts ────────────────────────────────────────────────────────────
    // Show a temporary notification.
    // type: 'info' | 'success' | 'error' | 'warning'   (default: 'info')
    // duration: milliseconds                            (default: 3000)

    ctx.toast('Addon loaded!', 'success');
    // ctx.toast('Something went wrong', 'error', 5000);


    // ── Clock ticks ───────────────────────────────────────────────────────
    // Callback fires every second with the current Date.
    // Auto-unsubscribed on unload.

    ctx.onTick(date => {
      // Example: update a custom display
      // wrap.querySelector('.clock-span').textContent = date.toLocaleTimeString();
    });


    // ── Inter-addon events ────────────────────────────────────────────────
    // A shared event bus. All addons share the same bus.
    // Event names are automatically prefixed with 'addon:' internally.
    // ctx.on returns an unsubscribe function; you don't need to call it
    // manually — it is also called automatically on unload.

    const unsub = ctx.on('some-event', payload => {
      console.log('Received:', payload);
    });

    ctx.emit('some-event', { hello: 'world' });

    // Unsubscribe early if needed:
    // unsub();


    // ── Accessing the startpage event ─────────────────────────────────────
    // The host page fires 'startpage:tick' every second.
    // ctx.onTick is the convenience wrapper — use that instead.
    // For other host events, listen on document directly and
    // register cleanup via ctx.onUnload.

    const hostHandler = () => { /* … */ };
    document.addEventListener('startpage:some-event', hostHandler);
    ctx.onUnload(() => document.removeEventListener('startpage:some-event', hostHandler));


    // ── Utilities ─────────────────────────────────────────────────────────
    // ctx.utils exposes the host's utility helpers:
    //
    //   ctx.utils.favicon(url)         — Google favicon CDN URL for a domain
    //   ctx.utils.validUrl(string)     — returns true if string is a valid URL
    //   ctx.utils.load(key, fallback)  — raw localStorage read (JSON-parsed)
    //   ctx.utils.save(key, data)      — raw localStorage write (JSON-stringified)
    //
    // Prefer ctx.storage over ctx.utils.load/save so your keys stay namespaced.

    const fav = ctx.utils.favicon('https://github.com');


    // ── Cleanup ───────────────────────────────────────────────────────────
    // Both styles work and can be mixed:
    //
    // Option A — return a single function:
    //   return () => { /* teardown */ };
    //
    // Option B — register one or more callbacks with onUnload:
    ctx.onUnload(() => {
      console.log(`[${ctx.name}] unloaded — scopeId was: ${ctx.scopeId}`);
    });

  }, // end init
};


// ── Context API quick-reference ──────────────────────────────────────────────
//
// DOM Injection
//   ctx.injectCSS(css)                                    -> void
//   ctx.injectHTML(slot, html)                            -> HTMLElement (wrapper)
//   ctx.injectPanel({ id?, className? })                  -> HTMLElement
//   ctx.addToolbarBtn({ icon?, label?, onClick? })        -> HTMLButtonElement
//
//   Slots: 'before-search' | 'after-search' | 'after-shortcuts' | 'top-bar' | 'body'
//
// Settings
//   ctx.addSettingsSection(title)                                         -> SectionEl
//   ctx.addSettingsRow(section, label, controlHTML)                       -> RowEl
//   ctx.addSettingsToggle(section, label, key, default, onChange?)        -> { row, input }
//   ctx.addSettingsInput(section, label, key, placeholder?, onChange?)    -> { row, input }
//   ctx.addSettingsButton(section, label, btnText, onClick)               -> RowEl
//
// Modals
//   ctx.createModal(name, html, { size? })   -> { element, open(), close() }
//   ctx.openModal(name)                      -> void   (scoped shorthand)
//   ctx.closeModal(name)                     -> void
//
// Notifications
//   ctx.toast(message, type?, duration?)     -> void
//   types: 'info' | 'success' | 'error' | 'warning'
//
// Storage  (auto-namespaced to this addon)
//   ctx.storage.get(key)          -> value | null
//   ctx.storage.set(key, value)   -> void
//   ctx.storage.remove(key)       -> void
//   ctx.storage.all()             -> Record<string, any>
//
// Events
//   ctx.emit(eventName, detail?)             -> void
//   ctx.on(eventName, callback)              -> unsubscribeFn
//
// Clock
//   ctx.onTick(callback: (date: Date) => void)   -> void
//
// Utilities
//   ctx.utils.favicon(url)         -> string
//   ctx.utils.validUrl(string)     -> boolean
//   ctx.utils.load(key, fallback)  -> any
//   ctx.utils.save(key, data)      -> void
//
// Identity & cleanup
//   ctx.name      — install ID (filename without .js)
//   ctx.scopeId   — 'addon-{name}', used as DOM ID prefix
//   ctx.onUnload(fn)   -> void   (can call multiple times)