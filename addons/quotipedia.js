// ── Quotipedia Addon ────────────────────────────────────────────────────────
const INDEX_URL = 'https://raw.githubusercontent.com/ImDuck42/Quotipedia/refs/heads/main/data/quotes/_index.json';
const BASE_URL  = 'https://raw.githubusercontent.com/ImDuck42/Quotipedia/refs/heads/main/data/quotes/';

export default {
  name: 'Quotipedia',
  version: '1.2.1',
  description: 'A floating bottom-left glass card that displays a random quote on every load.',
  author: 'Startpage Addon',
  icon: 'format_quote',

  async init(ctx) {
    // ── CSS Style Customization ───────────────────────────
    ctx.injectCSS(`
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');

      .quotipedia-card {
        /* Color matching specs integrated smoothly with glassmorphism */
        --q-accent: #e8c97a;
        --q-accent2: #c9a855;
        --q-text: #f0ece3;
        --q-muted: #7a7470;

        position: fixed;
        left: 20px;
        bottom: 20px;
        width: 320px;
        z-index: -1;
        padding: 14px 16px;

        /* Maintains startpage glassmorphism properties */
        background: var(--glass-bg) !important;
        backdrop-filter: blur(25px) saturate(140%) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: var(--r-md) !important;
        box-shadow: var(--glass-shadow) !important;
        color: var(--q-text) !important;

        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      /* Responsiveness: remains securely fixed to the bottom viewport boundary */
      @media (max-width: 480px) {
        .quotipedia-card {
          left: 12px !important;
          right: 12px !important;
          bottom: 12px !important;
          width: auto !important;
        }
      }

      .q-text {
        margin: 0 0 6px 0;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.25rem;
        line-height: 1.45;
        font-style: italic;
        color: var(--q-text);
      }

      .q-author {
        display: block;
        font-size: 0.72rem;
        text-align: right;
        color: var(--q-accent);
        font-weight: 600;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .q-tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
        border-top: 1px dashed rgba(255, 255, 255, 0.1);
        padding-top: 6px;
      }

      .q-tag {
        font-family: 'DM Mono', monospace;
        font-size: 0.6rem;
        color: var(--q-muted);
        background: rgba(255, 255, 255, 0.04);
        padding: 1px 5px;
        border-radius: var(--r-sm);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .q-quote-loader {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 60px;
      }

      .q-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--q-accent);
        border-radius: 50%;
        animation: q-spin 0.75s linear infinite;
      }

      @keyframes q-spin {
        to { transform: rotate(360deg); }
      }
    `);

    // ── UI Markup ─────────────────────────────────────────
    const cardHtml = `
      <div class="quotipedia-card">
        <div class="q-quote-loader" id="q-loader">
          <span class="q-spinner"></span>
        </div>
        <div class="q-quote-content hidden" id="q-content">
          <blockquote class="q-text"></blockquote>
          <cite class="q-author"></cite>
          <div class="q-tags-container hidden" id="q-tags"></div>
        </div>
      </div>
    `;

    // ── DOM Insertion ─────────────────────────────────────
    const card = ctx.injectHTML('body', cardHtml);
    const loaderEl = card.querySelector('#q-loader');
    const contentEl = card.querySelector('#q-content');
    const textEl = card.querySelector('.q-text');
    const authorEl = card.querySelector('.q-author');
    const tagsEl = card.querySelector('#q-tags');

    // ── Data Services ─────────────────────────────────────
    const fetchRandomQuote = async () => {
      try {
        const indexRes = await fetch(INDEX_URL);
        if (!indexRes.ok) throw new Error('Directory connection issue.');
        
        const indexData = await indexRes.json();
        const files = indexData.files || [];
        if (files.length === 0) throw new Error('Directory index is empty.');

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const quoteRes = await fetch(`${BASE_URL}${randomFile}`);
        if (!quoteRes.ok) throw new Error('Quote file query issue.');

        return await quoteRes.json();

      } catch (err) {
        console.warn('[Quotipedia] Unable to retrieve random quote:', err);
        return null;
      }
    };

    // ── Render Initialization ─────────────────────────────
    const initialize = async () => {
      const data = await fetchRandomQuote();

      if (data) {
        textEl.textContent = `"${data.text || 'No quote content provided.'}"`;
        authorEl.textContent = `— ${data.author || 'Anonymous'}`;

        if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
          tagsEl.innerHTML = data.tags.map(tag => `<span class="q-tag">#${tag}</span>`).join('');
          tagsEl.classList.remove('hidden');
        } else {
          tagsEl.innerHTML = '';
          tagsEl.classList.add('hidden');
        }

        loaderEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
      } else {
        textEl.textContent = 'Could not load community quote.';
        authorEl.textContent = '— Offline';
        loaderEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
      }
    };

    initialize();
  }
};