// ========== ADDON: NOTES ==========
// A persistent sticky-note pad that lives below the shortcuts grid.
// Supports multiple named notes, spec-compliant Markdown rendering, and pinning.

export default {
    name        : 'Notes',
    version     : '1.2.0',
    description : 'Quick-access sticky notes with full markdown previews and oldest-first pinning',
    author      : 'startpage',
    icon        : 'sticky_note_2',

    async init(ctx) {
        // ---- Full Markdown Engine ESM Loader ----
        let markedEngine = null;
        try {
            // Import the official Marked.js ES module directly from CDN
            const markedModule = await import("https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js");
            markedEngine = markedModule.marked;
        } catch (err) {
            console.warn('[Notes Addon] Failed to dynamically load Marked.js engine:', err);
        }

        // ---- State ----
        const load  = () => ctx.storage.get('notes') ?? [];
        const save  = (notes) => ctx.storage.set('notes', notes);

        let   notes         = load();
        const leftmostIndex = notes.findIndex(note => note.pinned);
        let   activeIndex   = leftmostIndex !== -1 ? leftmostIndex : 0;

        // ---- Markdown Compilation Selector ----
        const parseMarkdown = (text) => {
            if (!text) return '<p style="opacity:0.4;font-style:italic;margin:0;">No content inside note...</p>';
            if (markedEngine) {
                return markedEngine.parse(text);
            }
            // Basic secure escape fallback if offline or CDN is unreachable
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
        };

        // ---- CSS Styles ----
        ctx.injectCSS(`
            .notes-addon {
                width      : 100%;
                max-width  : 500px;
                margin-top : 10px;
            }

            .notes-tabs {
                display         : flex;
                gap             : 4px;
                margin-bottom   : -1px; /* Overlaps body border to eliminate visual gap */
                position        : relative;
                z-index         : 2; /* Keeps active registers sitting on top of the note body card */
                overflow-x      : auto;
                scrollbar-width : none;
                align-items     : flex-end;
                backdrop-filter : blur(5px);
            }

            .notes-tabs::-webkit-scrollbar { display: none; }

            .notes-tab {
                background    : rgba(255,255,255,0.07);
                border        : 1px solid rgba(255,255,255,0.12);
                border-radius : 8px 8px 0 0;
                color         : rgba(255,255,255,0.6);
                padding       : 5px 12px;
                font-size     : 0.75rem;
                cursor        : pointer;
                white-space   : nowrap;
                transition    : all 0.15s ease;
                display       : flex;
                align-items   : center;
                gap           : 6px;
                user-select   : none;
                -webkit-user-select : none;
                height        : 28px;
            }

            .notes-tab.active {
                background : rgba(255,255,255,0.075) !important;
                border-color: var(--accent) var(--accent) transparent var(--accent);
                border-bottom: 1px solid rgba(255,255,255,0.05); /* Masks the body top-border segment */
                color      : #fff;
                height     : 30px;
            }

            .notes-tab .tab-close {
                font-size  : 14px;
                opacity    : 0.4;
                transition : opacity 0.15s;
            }

            .notes-tab:hover .tab-close { opacity: 1; }

            .notes-tab .tab-pin {
                font-size  : 14px;
                color      : var(--accent);
            }

            .notes-tab-new {
                background    : transparent;
                border        : 1px dashed rgba(255,255,255,0.25);
                border-radius : 8px;
                color         : rgba(255,255,255,0.4);
                width         : 28px;
                height        : 28px;
                font-size     : 1rem;
                cursor        : pointer;
                display       : flex;
                align-items   : center;
                justify-content : center;
                flex-shrink   : 0;
                transition    : all 0.15s;
                margin-bottom : 1px;
            }

            .notes-tab-new:hover {
                background  : rgba(255,255,255,0.08);
                color       : #fff;
            }

            .notes-body {
                background      : rgba(255,255,255,0.05);
                backdrop-filter : blur(20px);
                border          : 1px solid rgba(255,255,255,0.12);
                border-radius   : 0 12px 12px 12px;
                padding         : 12px;
                display         : flex;
                flex-direction  : column;
                gap             : 8px;
                position        : relative;
                z-index         : 1; /* Sits directly below the tabs overlap level */
            }

            .notes-body-header {
                display         : flex;
                justify-content : space-between;
                align-items     : center;
                gap             : 12px;
                border-bottom   : 1px solid rgba(255,255,255,0.1);
                padding-bottom  : 6px;
                margin-bottom   : 2px;
            }

            .notes-title-input {
                background   : transparent;
                border       : none;
                color        : #fff;
                font-weight  : 600;
                font-size    : 0.9rem;
                width        : 100%;
                padding      : 0;
            }

            .notes-title-input::placeholder { color: rgba(255,255,255,0.3); }
            .notes-title-input:focus        { outline: none; }

            .notes-toolbar {
                display     : flex;
                align-items : center;
                gap         : 4px;
            }

            .notes-tool-btn {
                background    : transparent;
                color         : rgba(255,255,255,0.4);
                border        : none;
                cursor        : pointer;
                display       : flex;
                align-items   : center;
                justify-content : center;
                width         : 24px;
                height        : 24px;
                border-radius : 4px;
                transition    : all 0.15s;
            }

            .notes-tool-btn:hover {
                background : rgba(255,255,255,0.08);
                color      : #fff;
            }

            .notes-tool-btn.active {
                color : var(--accent);
            }

            .notes-textarea {
                background : transparent;
                border     : none;
                color      : rgba(255,255,255,0.85);
                font-size  : 0.85rem;
                line-height : 1.55;
                width      : 100%;
                resize     : none;
                min-height : 100px;
                max-height : 280px;
                font-family : inherit;
                field-sizing: content;
            }

            .notes-textarea::placeholder { color: rgba(255,255,255,0.25); }
            .notes-textarea:focus        { outline: none; }

            /* Compiled Markdown Preview Container Styles */
            .notes-preview-box {
                font-size   : 0.85rem;
                line-height : 1.55;
                color       : rgba(255,255,255,0.8);
                min-height  : 100px;
                max-height  : 280px;
                overflow-y  : auto;
                user-select : text;
                -webkit-user-select : text;
                padding-right : 4px;
            }

            .notes-preview-box h1,
            .notes-preview-box h2,
            .notes-preview-box h3,
            .notes-preview-box h4 {
                color: var(--accent);
                margin: 0 0 6px 0;
            }
            .notes-preview-box h1 { font-size: 1.25rem; }
            .notes-preview-box h2 { font-size: 1.15rem; }
            .notes-preview-box h3 { font-size: 1.05rem; }
            .notes-preview-box h4 { font-size: 0.95rem; }
            .notes-preview-box p { margin: 0 0 8px 0; }
            
            .notes-preview-box ul,
            .notes-preview-box ol {
                margin: 0 0 8px 0;
                padding-left: 18px;
            }
            .notes-preview-box li { margin-bottom: 2px; }

            .notes-preview-box code {
                background: rgba(255,255,255,0.08);
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.8rem;
            }

            .notes-preview-box pre {
                background: rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.05);
                border-radius: 6px;
                padding: 10px;
                overflow-x: auto;
                margin: 8px 0;
            }
            .notes-preview-box pre code {
                background: transparent;
                padding: 0;
                border: none;
            }

            .notes-preview-box blockquote {
                border-left: 3px solid var(--accent);
                margin: 8px 0;
                padding-left: 10px;
                color: rgba(255,255,255,0.5);
                font-style: italic;
            }

            .notes-preview-box table {
                border-collapse: collapse;
                width: 100%;
                margin: 8px 0;
            }
            .notes-preview-box th,
            .notes-preview-box td {
                border: 1px solid rgba(255,255,255,0.1);
                padding: 6px 10px;
                text-align: left;
            }
            .notes-preview-box th {
                background: rgba(255,255,255,0.05);
                color: var(--accent);
            }

            .notes-footer {
                display         : flex;
                justify-content : space-between;
                align-items     : center;
                font-size       : 0.7rem;
                color           : rgba(255,255,255,0.3);
                padding-top     : 6px;
                border-top      : 1px solid rgba(255,255,255,0.07);
            }

            .notes-char-count { font-variant-numeric: tabular-nums; }
        `);

        // ---- DOM ----
        const panel = ctx.injectPanel({ id: 'addon-notes-panel', className: 'notes-addon' });

        // ---- Render ----
        const render = () => {
            // Ensure at least one note exists
            if (notes.length === 0) {
                notes.push({ title: 'Note 1', body: '', pinned: false, preview: false });
                save(notes);
            }
            if (activeIndex >= notes.length) activeIndex = notes.length - 1;

            const note = notes[activeIndex];

            panel.innerHTML = '';

            // Tabs
            const tabsEl = document.createElement('div');
            tabsEl.className = 'notes-tabs';

            const pinnedTabs = [];
            const unpinnedTabs = [];

            // Generate registers, caching references based on pinned status
            notes.forEach((n, i) => {
                const tab      = document.createElement('button');
                tab.className  = `notes-tab${i === activeIndex ? ' active' : ''}`;
                
                if (n.pinned) {
                    tab.innerHTML  = `
                        <span class="material-symbols-outlined tab-pin" title="Pinned Note">push_pin</span>
                        <span>${n.title || `Note ${i + 1}`}</span>
                    `;
                    // Oldest pin goes first naturally because notes array is traversed chronologically (index 0 to length-1)
                    pinnedTabs.push({ tab, index: i });
                } else {
                    tab.innerHTML  = `
                        <span>${n.title || `Note ${i + 1}`}</span>
                        <span class="material-symbols-outlined tab-close" data-tab-close="${i}" title="Delete Note">close</span>
                    `;
                    unpinnedTabs.push({ tab, index: i });
                }

                tab.addEventListener('click', (evt) => {
                    if (evt.target.closest('[data-tab-close]')) {
                        const idx = parseInt(evt.target.closest('[data-tab-close]').dataset.tabClose);
                        notes.splice(idx, 1);
                        if (activeIndex >= notes.length) activeIndex = Math.max(0, notes.length - 1);
                        save(notes);
                        render();
                    } else {
                        activeIndex = i;
                        render();
                    }
                });
            });

            // Append oldest-to-newest pinned on the left, then unpinned
            pinnedTabs.forEach(item => tabsEl.appendChild(item.tab));
            unpinnedTabs.forEach(item => tabsEl.appendChild(item.tab));

            // New tab button
            const newBtn       = document.createElement('button');
            newBtn.className   = 'notes-tab-new';
            newBtn.innerHTML   = '<span class="material-symbols-outlined" style="font-size:16px">add</span>';
            newBtn.addEventListener('click', () => {
                notes.push({ title: `Note ${notes.length + 1}`, body: '', pinned: false, preview: false });
                activeIndex = notes.length - 1;
                save(notes);
                render();
            });
            tabsEl.appendChild(newBtn);
            panel.appendChild(tabsEl);

            // Body
            const body       = document.createElement('div');
            body.className   = 'notes-body';

            // Custom Toolbar Header
            const headerRow = document.createElement('div');
            headerRow.className = 'notes-body-header';

            const titleInput          = document.createElement('input');
            titleInput.className      = 'notes-title-input';
            titleInput.type           = 'text';
            titleInput.value          = note.title;
            titleInput.placeholder    = 'Untitled note…';
            titleInput.style.userSelect = 'text';
            titleInput.style.webkitUserSelect = 'text';
            titleInput.addEventListener('input', () => {
                notes[activeIndex].title = titleInput.value;
                save(notes);
                const activeTab = tabsEl.querySelector('.notes-tab.active span:last-child');
                if (activeTab) activeTab.textContent = titleInput.value || `Note ${activeIndex + 1}`;
            });

            const toolbar = document.createElement('div');
            toolbar.className = 'notes-toolbar';

            // Pin toggle control button
            const pinBtn = document.createElement('button');
            pinBtn.className = `notes-tool-btn${note.pinned ? ' active' : ''}`;
            pinBtn.title = note.pinned ? 'Unpin Note' : 'Pin Note';
            pinBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">push_pin</span>';
            pinBtn.addEventListener('click', () => {
                notes[activeIndex].pinned = !notes[activeIndex].pinned;
                save(notes);
                render();
            });

            // Preview / Edit Markdown toggle button
            const previewBtn = document.createElement('button');
            previewBtn.className = `notes-tool-btn${note.preview ? ' active' : ''}`;
            previewBtn.title = note.preview ? 'Edit Markdown' : 'Preview Markdown';
            previewBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">${note.preview ? 'edit' : 'visibility'}</span>`;
            previewBtn.addEventListener('click', () => {
                notes[activeIndex].preview = !notes[activeIndex].preview;
                save(notes);
                render();
            });

            toolbar.appendChild(pinBtn);
            toolbar.appendChild(previewBtn);
            headerRow.appendChild(titleInput);
            headerRow.appendChild(toolbar);

            body.appendChild(headerRow);

            // View switching
            if (note.preview) {
                const previewBox = document.createElement('div');
                previewBox.className = 'notes-preview-box';
                previewBox.innerHTML = parseMarkdown(note.body);
                body.appendChild(previewBox);
            } else {
                const textarea             = document.createElement('textarea');
                textarea.className         = 'notes-textarea';
                textarea.value             = note.body;
                textarea.placeholder       = 'Start typing… (Supports full markdown syntax)';
                textarea.style.userSelect  = 'text';
                textarea.style.webkitUserSelect = 'text';
                textarea.addEventListener('input', () => {
                    notes[activeIndex].body = textarea.value;
                    charCount.textContent   = `${textarea.value.length} chars`;
                    save(notes);
                });
                body.appendChild(textarea);
            }

            const footer    = document.createElement('div');
            footer.className = 'notes-footer';

            const charCount      = document.createElement('span');
            charCount.className  = 'notes-char-count';
            charCount.textContent = `${note.body.length} chars`;

            const ts      = document.createElement('span');
            ts.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;

            footer.appendChild(charCount);
            footer.appendChild(ts);
            body.appendChild(footer);

            panel.appendChild(body);
        };

        render();

        // ---- Settings ----
        const section = ctx.addSettingsSection('Notes');
        ctx.addSettingsButton(section, 'Clear all notes', 'Clear', () => {
            if (confirm('Delete all notes?')) {
                notes       = [{ title: 'Note 1', body: '', pinned: false, preview: false }];
                activeIndex = 0;
                save(notes);
                render();
                ctx.toast('Notes cleared', 'info');
            }
        });
    },
};