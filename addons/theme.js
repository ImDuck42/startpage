// ========== ADDON: THEMES ==========
// Live theme switcher — ships with 8 built-in themes
export default {
    name        : 'Themes',
    version     : '1.4.1',
    description : 'Live theme switcher with pre-configured color profiles',
    author      : 'startpage',
    icon        : 'palette',

    async init(ctx) {
        // ---- Built-in themes ----
        const THEMES = {
            default : {
                label       : 'Dusk (default)',
                gradient    : 'linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%)',
                accent      : '#764ba2',
                glassBg     : 'rgba(255,255,255,0.08)',
                glassBorder : 'rgba(255,255,255,0.15)',
                text        : '#ffffff',
                blur        : '25px',
            },
            midnight : {
                label       : 'Midnight Blue',
                gradient    : 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                accent      : '#4facfe',
                glassBg     : 'rgba(255,255,255,0.06)',
                glassBorder : 'rgba(100,180,255,0.18)',
                text        : '#e8f4ff',
                blur        : '25px',
            },
            aurora : {
                label       : 'Aurora',
                gradient    : 'linear-gradient(135deg, #0a1628 0%, #1a3a2a 50%, #0d1f3c 100%)',
                accent      : '#00f2a9',
                glassBg     : 'rgba(0,242,169,0.05)',
                glassBorder : 'rgba(0,242,169,0.2)',
                text        : '#c8ffe8',
                blur        : '25px',
            },
            ember : {
                label       : 'Ember',
                gradient    : 'linear-gradient(135deg, #1a0500 0%, #3d1100 50%, #6b2500 100%)',
                accent      : '#ff6b35',
                glassBg     : 'rgba(255,107,53,0.06)',
                glassBorder : 'rgba(255,107,53,0.2)',
                text        : '#ffe8d6',
                blur        : '25px',
            },
            sakura : {
                label       : 'Sakura',
                gradient    : 'linear-gradient(135deg, #2d0a1e 0%, #4a1030 50%, #1e0815 100%)',
                accent      : '#ff6fa3',
                glassBg     : 'rgba(255,111,163,0.07)',
                glassBorder : 'rgba(255,111,163,0.22)',
                text        : '#ffe0f0',
                blur        : '25px',
            },
            forest : {
                label       : 'Forest',
                gradient    : 'linear-gradient(135deg, #0b1a0e 0%, #1a3320 50%, #0e2314 100%)',
                accent      : '#4caf50',
                glassBg     : 'rgba(76,175,80,0.06)',
                glassBorder : 'rgba(76,175,80,0.2)',
                text        : '#d4edda',
                blur        : '25px',
            },
            cyberpunk : {
                label       : 'Cyberpunk',
                gradient    : 'linear-gradient(135deg, #0f051d 0%, #291147 50%, #4a1c6d 100%)',
                accent      : '#ff0055',
                glassBg     : 'rgba(255,0,85,0.06)',
                glassBorder : 'rgba(255,0,85,0.25)',
                text        : '#00f0ff',
                blur        : '20px',
            },
            catppuccin : {
                label       : 'Mocha (Catppuccin)',
                gradient    : 'linear-gradient(135deg, #1e1e2e 0%, #11111b 100%)',
                accent      : '#cba6f7',
                glassBg     : 'rgba(30,30,46,0.45)',
                glassBorder : 'rgba(180,190,254,0.15)',
                text        : '#cdd6f4',
                blur        : '25px',
            }
        };

        // ---- State ----
        const loadActive = () => ctx.storage.get('activeTheme') ?? 'default';
        let activeThemeKey = loadActive();

        // ---- Apply theme to CSS vars ----
        const applyTheme = (theme) => {
            const root  = document.documentElement.style;
            root.setProperty('--grad',          theme.gradient);
            root.setProperty('--accent',        theme.accent);
            root.setProperty('--glass-bg',      theme.glassBg);
            root.setProperty('--glass-border',  theme.glassBorder);
            root.setProperty('--text',          theme.text);
            root.setProperty('--glass-blur',    theme.blur ?? '25px');
        };

        const activate = (key) => {
            activeThemeKey = key;
            ctx.storage.set('activeTheme', key);
            const theme = THEMES[key] ?? THEMES.default;
            applyTheme(theme);
            renderPicker();
            ctx.toast(`Theme: ${theme.label}`, 'success');
        };

        // Apply on load
        applyTheme(THEMES[activeThemeKey] ?? THEMES.default);

        ctx.onUnload(() => {
            // Restore structural defaults
            const root = document.documentElement.style;
            ['--grad','--accent','--glass-bg','--glass-border','--text','--glass-blur']
                .forEach(v => root.removeProperty(v));
        });

        // ---- CSS Styles ----
        ctx.injectCSS(`
            /* Force dynamic modal blur override on all glass elements */
            .glass-card {
                backdrop-filter: blur(var(--glass-blur, 25px)) !important;
            }

            .theme-picker {
                display               : grid;
                grid-template-columns : repeat(4, 1fr);
                gap                   : 8px;
            }

            @media (max-width: 480px) {
                .theme-picker {
                    grid-template-columns : repeat(2, 1fr);
                }
            }

            .theme-swatch {
                position      : relative;
                border-radius : var(--r-md);
                aspect-ratio  : 1 / 1;
                cursor        : pointer;
                border        : 2px solid transparent;
                overflow      : hidden;
                transition    : transform 0.15s, border-color 0.15s;
            }

            .theme-swatch:hover   { transform: scale(1.05); }
            .theme-swatch.active  { border-color: #fff; }

            .theme-swatch-bg {
                position    : absolute;
                inset       : 0;
                border-radius : calc(var(--r-md) - 2px);
            }

            .theme-swatch-label {
                position      : absolute;
                bottom        : 0;
                left          : 0;
                right         : 0;
                background    : rgba(0,0,0,0.55);
                color         : #fff;
                font-size     : 0.6rem;
                text-align    : center;
                padding       : 3px 4px;
                line-height   : 1.2;
                white-space   : nowrap;
                overflow      : hidden;
                text-overflow : ellipsis;
            }

            .theme-swatch .theme-check {
                position  : absolute;
                top       : 4px;
                right     : 4px;
                font-size : 16px;
                color     : #fff;
                display   : none;
                filter    : drop-shadow(0 1px 2px rgba(0,0,0,0.8));
            }

            .theme-swatch.active .theme-check { display: block; }
        `);

        // ---- Toolbar button ----
        ctx.addToolbarBtn({
            icon    : 'palette',
            label   : 'Themes',
            onClick : () => themeModal.open(),
        });

        // ---- Modal Layout ----
        const themeModal = ctx.createModal('themes', `
            <h3>Themes</h3>
            <div class="theme-picker" id="theme-picker"></div>
        `);

        // ---- Populate picker ----
        const renderPicker = () => {
            const picker = document.getElementById('theme-picker');
            if (!picker) return;
            picker.innerHTML = '';

            Object.entries(THEMES).forEach(([key, theme]) => {
                const swatch = document.createElement('div');
                swatch.className = `theme-swatch${activeThemeKey === key ? ' active' : ''}`;
                swatch.innerHTML = `
                    <div class="theme-swatch-bg" style="background:${theme.gradient}"></div>
                    <span class="material-symbols-outlined theme-check">check_circle</span>
                    <div class="theme-swatch-label">${theme.label}</div>
                `;
                swatch.addEventListener('click', () => activate(key));
                picker.appendChild(swatch);
            });
        };

        // Wire open hook to populate components
        const origOpen = themeModal.open;
        themeModal.open = () => {
            origOpen();
            renderPicker();
        };

        // Keyboard Shortcut: Alt + T cycles themes instantly
        const handleKeyPress = (e) => {
            if (e.altKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                const keys = Object.keys(THEMES);
                const currIdx = keys.indexOf(activeThemeKey);
                const nextKey = keys[(currIdx + 1) % keys.length];
                activate(nextKey);
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        ctx.onUnload(() => document.removeEventListener('keydown', handleKeyPress));

        // ---- Settings Integration ----
        const section = ctx.addSettingsSection('Themes');
        ctx.addSettingsButton(section, 'Open theme picker', 'Change Theme', () => themeModal.open());

        // Initial launch
        renderPicker();
    },
};