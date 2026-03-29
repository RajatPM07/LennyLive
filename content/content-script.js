// content/content-script.js
// Detection + Shadow DOM UI injection for Lenny Live.
// MV3 content scripts cannot use ES modules — this is one intentionally long file.

// ─── Shadow DOM Setup ────────────────────────────────────────────────────────

const host = document.createElement('div');
host.id = 'lenny-live-root';
const shadow = host.attachShadow({ mode: 'open' }); // open = inspectable in DevTools
document.body.appendChild(host);

// Fonts: use system font stack — injecting Google Fonts into document.head violates
// font-src CSP on Notion, Linear, Jira, and most enterprise apps.

// Inject all styles into shadow root
const style = document.createElement('style');
style.textContent = `
  /* ── LennyLive Unified Theme ── */
  :host {
    --bg-surface: #fdfcf6;
    --bg-surface-hover: #f3f0e6;
    --bg-dark: #1a1c1c;
    --text-dark: #1a1c1c;
    --text-light: #ffffff;
    --text-muted: #5e5e5e;
    --accent-orange: #ff6e40;
    --accent-orange-dark: #a23f1d;
    --pill-bg: #fef3c7;
    --pill-text: #92400e;
    --border-light: rgba(0,0,0,0.05);
    --error-bg: #1a1a1a;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --font-serif: Georgia, 'Times New Roman', serif;
  }
  * { box-sizing: border-box; }

  /* 1. Listening Indicator */
  #ll-indicator {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: var(--bg-surface);
    border: 1px solid var(--border-light);
    border-radius: 24px;
    padding: 8px 16px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    z-index: 2147483647;
    pointer-events: none;
    align-items: center;
    gap: 12px;
  }
  #ll-indicator:not(.hidden) { display: flex; }
  #ll-indicator.hidden { display: none !important; }
  .ll-wave { display: flex; align-items: flex-end; gap: 2px; height: 12px; }
  .ll-bar { width: 2px; background: var(--accent-orange); border-radius: 1px; animation: ll-bounce 1s ease-in-out infinite; }
  .ll-bar:nth-child(1) { height: 8px; }
  .ll-bar:nth-child(2) { height: 12px; animation-delay: 0.2s; }
  .ll-bar:nth-child(3) { height: 6px; animation-delay: 0.4s; }
  .ll-bar:nth-child(4) { height: 10px; animation-delay: 0.6s; }
  @keyframes ll-bounce { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
  #ll-text { font-family: var(--font-sans); font-size: 13px; font-weight: 500; color: var(--text-dark); }
  #ll-indicator.loading .ll-wave { display: none; }
  #ll-indicator.loading #ll-text { animation: ll-pulse 1.5s infinite; }
  @keyframes ll-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* 2. Toast */
  #ll-toast {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: var(--error-bg);
    border-radius: 8px;
    padding: 12px 16px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--text-light);
    z-index: 2147483647;
    pointer-events: none;
    max-width: 280px;
    line-height: 1.4;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  }
  #ll-toast.visible { display: block; opacity: 1; transform: translateY(0); }
  #ll-toast.fading { opacity: 0; transform: translateY(8px); }
  .toast-content { display: flex; align-items: center; gap: 12px; }
  .toast-icon { color: #f87171; font-weight: bold; }

  /* 3. Tooltip */
  #ll-tooltip {
    display: none;
    position: fixed;
    bottom: 80px;
    right: 32px;
    background: var(--error-bg);
    border-radius: 4px;
    padding: 8px 12px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--text-light);
    z-index: 2147483647;
    pointer-events: none;
  }
  #ll-tooltip::after {
    content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    border: 4px solid transparent; border-top-color: var(--error-bg);
  }
  #ll-tooltip.visible { display: block; }

  /* 4. Ambient Glow Dot (replaces Chip) */
  #ll-chip {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 370px;
    z-index: 2147483647;
  }
  #ll-chip.visible { display: block; }
  .glow-wrapper { position: relative; display: flex; align-items: center; cursor: pointer; }
  .pulse-dot-wrapper {
    position: relative; width: 14px; height: 14px; background: var(--accent-orange);
    border-radius: 50%; z-index: 10; box-shadow: 0 0 12px rgba(255,110,64,0.4); transition: transform 0.3s;
  }
  .pulse-dot-wrapper::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: var(--accent-orange); border-radius: 50%;
    animation: ll-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  }
  @keyframes ll-pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
  .glow-wrapper:hover .pulse-dot-wrapper { transform: scale(1.1); animation: none; }
  .pill-content {
    position: absolute; right: 7px; height: 28px; background: var(--bg-dark); border-radius: 14px;
    display: flex; align-items: center; overflow: hidden; opacity: 0; width: 0px;
    transition: all 0.3s ease-out; pointer-events: none; white-space: nowrap;
  }
  .glow-wrapper:hover .pill-content { width: 260px; padding-left: 12px; padding-right: 20px; opacity: 1; pointer-events: auto; }
  .pill-text { color: var(--text-light); font-family: var(--font-sans); font-size: 11px; font-weight: 500; }

  /* 5. Postcard */
  #ll-postcard {
    position: fixed;
    bottom: 32px; right: 32px; width: 320px;
    background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    font-family: var(--font-sans); z-index: 2147483647; overflow: hidden;
    display: flex; flex-direction: column;
  }
  #ll-postcard.hidden { display: none; }
  #ll-postcard:not(.hidden):not(.ll-postcard-hiding) { animation: ll-postcard-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  #ll-postcard.ll-postcard-hiding { animation: ll-postcard-out 0.2s ease-in forwards; }
  @keyframes ll-postcard-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes ll-postcard-out { from { transform: translateY(0); opacity: 1; } to { transform: translateY(20px); opacity: 0; } }

  .pc-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 8px; }
  .pc-logo { font-family: var(--font-serif); font-size: 16px; font-weight: 600; font-style: italic; color: var(--text-dark); }
  .pc-actions { display: flex; gap: 12px; }
  .pc-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 14px; display: flex; align-items: center; transition: color 0.2s; padding: 0; }
  .pc-btn:hover { color: var(--accent-orange); }

  .pc-body { padding: 8px 24px 16px; display: flex; flex-direction: column; }
  .pc-framing { font-family: var(--font-serif); font-style: italic; font-size: 13px; color: var(--text-muted); margin: 0 0 12px 0; display: none; }
  .pc-topic { align-self: flex-start; background: var(--pill-bg); color: var(--pill-text); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 12px; margin-bottom: 16px; }
  .pc-quote-wrapper { position: relative; max-height: 100px; overflow: hidden; transition: max-height 0.4s ease-in-out; }
  .pc-quote { font-family: var(--font-serif); font-size: 18px; line-height: 1.4; color: var(--text-dark); font-style: italic; margin: 0; }
  .pc-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 48px; background: linear-gradient(transparent, var(--bg-surface)); transition: opacity 0.4s; }
  .pc-quote-wrapper.expanded { max-height: 1000px; }
  .pc-quote-wrapper.expanded .pc-fade { opacity: 0; pointer-events: none; }
  .pc-read-more { align-self: flex-start; margin-top: 12px; background: var(--bg-dark); color: var(--bg-surface); border: none; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 16px; border-radius: 16px; cursor: pointer; transition: background 0.2s; }
  .pc-read-more:hover { background: var(--accent-orange-dark); }
  .pc-read-more.hidden { display: none; }

  .pc-footer { border-top: 1px solid var(--border-light); padding: 12px 24px 14px; background: rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; }
  .pc-footer-meta { display: flex; flex-direction: column; gap: 2px; }
  .pc-guest { font-family: var(--font-sans); font-weight: 700; font-size: 12px; color: var(--text-dark); }
  .pc-episode { font-family: var(--font-sans); font-size: 10px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; }
  .pc-source-link { font-family: var(--font-sans); font-size: 10px; font-weight: 600; color: var(--accent-orange); text-decoration: none; white-space: nowrap; opacity: 0.85; transition: opacity 0.15s; }
  .pc-source-link:hover { opacity: 1; }
  .pc-source-link.hidden { display: none; }

  /* 6. Related Insights (shown on Read more expand) */
  .pc-related { margin-top: 16px; border-top: 1px solid var(--border-light); padding-top: 12px; display: flex; flex-direction: column; gap: 10px; }
  .pc-related.hidden { display: none; }
  .pc-related-header { font-family: var(--font-sans); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 2px; }
  .pc-related-item { background: rgba(0,0,0,0.02); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .pc-related-topic { font-family: var(--font-sans); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pill-text); background: var(--pill-bg); padding: 2px 7px; border-radius: 8px; align-self: flex-start; }
  .pc-related-quote { font-family: var(--font-serif); font-style: italic; font-size: 12px; line-height: 1.45; color: var(--text-dark); }
  .pc-related-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
  .pc-related-guest { font-family: var(--font-sans); font-size: 10px; font-weight: 600; color: var(--text-muted); }
  .pc-related-link { font-family: var(--font-sans); font-size: 10px; font-weight: 600; color: var(--accent-orange); text-decoration: none; opacity: 0.85; transition: opacity 0.15s; }
  .pc-related-link:hover { opacity: 1; }

  /* 7. Selection Dot */
  #ll-selection-dot {
    display: none; position: fixed; z-index: 2147483647; cursor: pointer;
  }
  #ll-selection-dot.visible { display: block; }

  /* 8. Badge Pill (replaces Write+Pause Dot + Questions Panel) */
  #ll-badge-pill {
    display: none; position: fixed; bottom: 32px; right: 32px;
    z-index: 2147483647; flex-direction: column; align-items: flex-end; gap: 8px;
  }
  #ll-badge-pill.visible { display: flex; }

  .ll-badge-trigger {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-dark); border-radius: 20px;
    padding: 8px 16px 8px 12px;
    cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: transform 0.15s, box-shadow 0.15s;
    border: none; font-family: var(--font-sans);
  }
  .ll-badge-trigger:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
  .ll-badge-dot {
    width: 8px; height: 8px; background: var(--accent-orange);
    border-radius: 50%; flex-shrink: 0;
    animation: ll-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  }
  .ll-badge-dot.loading {
    animation: ll-spin 1s linear infinite;
    border: 2px solid rgba(255,110,64,0.3); border-top-color: var(--accent-orange);
    background: transparent; width: 10px; height: 10px;
  }
  .ll-badge-text {
    font-size: 12px; font-weight: 500; color: var(--text-light);
    white-space: nowrap;
  }
  .ll-badge-arrow { font-size: 12px; color: rgba(255,255,255,0.5); margin-left: 2px; }

  /* Chips panel — expands below badge pill */
  .ll-chips-panel {
    display: none; width: 320px;
    background: #ffffff; border: 1px solid rgba(222,192,184,0.2); border-radius: 12px;
    box-shadow: 0 32px 32px -4px rgba(26,28,28,0.06);
    flex-direction: column; overflow: hidden; font-family: var(--font-sans);
    animation: ll-postcard-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ll-chips-panel.visible { display: flex; }
  .ll-chips-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px 10px; border-bottom: 1px solid rgba(0,0,0,0.05);
  }
  .ll-chips-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .ll-chips-close { background: none; border: none; font-size: 16px; color: var(--text-muted); cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .ll-chips-close:hover { background: rgba(0,0,0,0.05); color: var(--text-dark); }
  .ll-chips-list { padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .ll-chip-btn {
    width: 100%; text-align: left; padding: 12px 14px;
    border-radius: 10px; border: 1px solid rgba(222,192,184,0.25);
    background: #f9f9f9; cursor: pointer;
    transition: all 0.15s; display: flex; justify-content: space-between; align-items: flex-start;
    font-family: var(--font-sans);
  }
  .ll-chip-btn:hover { background: #ffffff; border-color: rgba(162,63,29,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .ll-chip-btn-text { font-size: 13px; font-weight: 500; color: var(--text-dark); line-height: 1.4; padding-right: 12px; margin: 0; }
  .ll-chip-btn-arrow { color: rgba(162,63,29,0.4); font-size: 14px; transition: color 0.15s; flex-shrink: 0; margin-top: 1px; }
  .ll-chip-btn:hover .ll-chip-btn-arrow { color: #a23f1d; }

  /* Loading state for chips panel */
  .ll-chips-loading { padding: 20px 16px; display: flex; align-items: center; gap: 10px; }
  .ll-chips-loading-text { font-size: 12px; color: var(--text-muted); font-style: italic; }
  @keyframes ll-spin { to { transform: rotate(360deg); } }
`;
shadow.appendChild(style);

// 1. Indicator
const indicator = document.createElement('div');
indicator.id = 'll-indicator';
indicator.className = 'hidden';
indicator.innerHTML = `
  <div class="ll-wave">
    <div class="ll-bar"></div><div class="ll-bar"></div><div class="ll-bar"></div><div class="ll-bar"></div>
  </div>
  <span id="ll-text">Lenny is listening...</span>
`;
shadow.appendChild(indicator);

// 2. Mic denied tooltip
const tooltip = document.createElement('div');
tooltip.id = 'll-tooltip';
tooltip.textContent = 'Microphone access denied.';
shadow.appendChild(tooltip);

// 3. Ambient Glow Dot (replaces buzzword chip)
const chip = document.createElement('div');
chip.id = 'll-chip';
chip.innerHTML = `
  <div class="glow-wrapper" id="ll-chip-wrapper">
    <div class="pill-content"><span class="pill-text">Lenny has thoughts on <span id="ll-chip-topic"></span></span></div>
    <div class="pulse-dot-wrapper"></div>
  </div>
`;
shadow.appendChild(chip);

// 4. Toast
const toast = document.createElement('div');
toast.id = 'll-toast';
toast.innerHTML = '<div class="toast-content"><span class="toast-icon">✕</span><span id="ll-toast-text"></span></div>';
shadow.appendChild(toast);

// 5. Postcard
const postcard = document.createElement('div');
postcard.id = 'll-postcard';
postcard.className = 'hidden';
postcard.innerHTML = `
  <div class="pc-header">
    <span class="pc-logo">lennyLive</span>
    <div class="pc-actions">
      <button id="ll-btn-mute" class="pc-btn" title="Mute">🔇</button>
      <button id="ll-btn-save" class="pc-btn" title="Save">🔖</button>
      <button id="ll-btn-dismiss" class="pc-btn" title="Dismiss">✕</button>
    </div>
  </div>
  <div class="pc-body">
    <p id="ll-pc-framing" class="pc-framing">Connecting <span id="ll-pc-niche">this topic</span> to <span id="ll-pc-pm-topic"></span>...</p>
    <div class="pc-topic" id="ll-pc-topic"></div>
    <div class="pc-quote-wrapper" id="ll-quote-wrapper">
      <p class="pc-quote" id="ll-pc-quote"></p>
      <div class="pc-fade" id="ll-quote-fade"></div>
    </div>
    <button id="ll-btn-readmore" class="pc-read-more">Read more</button>
    <div id="ll-related" class="pc-related hidden"></div>
  </div>
  <div class="pc-footer">
    <div class="pc-footer-meta">
      <span class="pc-guest" id="ll-pc-guest"></span>
      <span class="pc-episode" id="ll-pc-source"></span>
    </div>
    <a id="ll-pc-link" class="pc-source-link hidden" target="_blank" rel="noopener noreferrer">↗ Source</a>
  </div>
`;
shadow.appendChild(postcard);

// 6. Selection Dot
const selectionDot = document.createElement('div');
selectionDot.id = 'll-selection-dot';
selectionDot.innerHTML = '<div class="pulse-dot-wrapper"></div>';
shadow.appendChild(selectionDot);

// 7. Badge Pill (replaces Write+Pause Dot + Questions Panel)
const badgePill = document.createElement('div');
badgePill.id = 'll-badge-pill';
badgePill.innerHTML = `
  <div class="ll-chips-panel" id="ll-chips-panel"></div>
  <button class="ll-badge-trigger" id="ll-badge-trigger" type="button">
    <span class="ll-badge-dot" id="ll-badge-dot"></span>
    <span class="ll-badge-text" id="ll-badge-text">Lenny has thoughts</span>
    <span class="ll-badge-arrow">→</span>
  </button>
`;
shadow.appendChild(badgePill);

// ─── UI Helper Functions ──────────────────────────────────────────────────────

function showIndicator(mode) {
  // mode: 'listening' | 'thinking' | 'loading'
  const text = shadow.getElementById('ll-text');
  indicator.classList.remove('hidden', 'loading');
  if (mode === 'listening') {
    text.textContent = 'Lenny is listening...';
  } else if (mode === 'thinking') {
    text.textContent = 'Lenny is thinking...';
  } else if (mode === 'loading') {
    indicator.classList.add('loading');
    text.textContent = 'Lenny is thinking...'; // visible but shimmer covers it
  }
}

function hideIndicator() {
  indicator.classList.add('hidden');
}

function showMicDeniedTooltip() {
  tooltip.classList.add('visible');
  setTimeout(() => tooltip.classList.remove('visible'), 4000);
}

function showBuzzwordChip(topic) {
  shadow.getElementById('ll-chip-topic').textContent = topic;
  chip.classList.remove('fading');
  chip.classList.add('visible');

  // Auto-fade after 10s
  const fadeTimer = setTimeout(() => {
    chip.classList.add('fading');
    setTimeout(() => chip.classList.remove('visible', 'fading'), 200);
  }, 10000);

  chip.onclick = () => {
    clearTimeout(fadeTimer);
    chip.classList.remove('visible', 'fading');
    activateLennyLive();
  };
}

// ─── Postcard ─────────────────────────────────────────────────────────────────

let autoDismissTimer = null;
let currentInsight = null; // held for Save button

function showPostcard(insight, relatedInsights = []) {
  currentInsight = insight;
  const pc = shadow.getElementById('ll-postcard');
  hideIndicator(); // always hide indicator — they share bottom-right corner
  pc.classList.remove('ll-postcard-hiding'); // cancel any in-flight exit animation

  // Populate content
  shadow.getElementById('ll-pc-topic').textContent = insight.topic;
  shadow.getElementById('ll-pc-quote').textContent = insight.pull_quote;
  shadow.getElementById('ll-pc-guest').textContent = insight.guest_name;
  const isNewsletter = insight.guest_name === 'Lenny Rachitsky';
  shadow.getElementById('ll-pc-source').textContent = isNewsletter
    ? 'Newsletter — lennysnewsletter.com'
    : 'Ep: ' + insight.episode_title;

  // Source link — podcast opens at exact timestamp, newsletter opens article
  const linkEl = shadow.getElementById('ll-pc-link');
  if (insight.youtube_url) {
    const url = (!isNewsletter && insight.timestamp_secs)
      ? `${insight.youtube_url}?t=${insight.timestamp_secs}`
      : insight.youtube_url;
    linkEl.href = url;
    linkEl.textContent = isNewsletter ? '↗ Read' : '↗ Watch';
    linkEl.classList.remove('hidden');
  } else {
    linkEl.classList.add('hidden');
  }

  const framingEl = shadow.getElementById('ll-pc-framing');
  if (insight.abstracted) { 
    framingEl.style.display = 'block';
    shadow.getElementById('ll-pc-pm-topic').textContent = insight.topic.toLowerCase();
  } else {
    framingEl.style.display = 'none';
  }

  // Read more expand logic reset
  shadow.getElementById('ll-quote-wrapper').classList.remove('expanded');
  shadow.getElementById('ll-btn-readmore').textContent = 'Read more';
  if (insight.pull_quote.length < 150) {
    shadow.getElementById('ll-btn-readmore').classList.add('hidden');
    shadow.getElementById('ll-quote-fade').style.display = 'none';
  } else {
    shadow.getElementById('ll-btn-readmore').classList.remove('hidden');
    shadow.getElementById('ll-quote-fade').style.display = 'block';
  }

  // Populate related insights (hidden until "Read more" is clicked)
  const relatedEl = shadow.getElementById('ll-related');
  relatedEl.classList.add('hidden');
  relatedEl.innerHTML = '';
  if (relatedInsights && relatedInsights.length > 0) {
    const header = document.createElement('div');
    header.className = 'pc-related-header';
    header.textContent = 'Related insights';
    relatedEl.appendChild(header);

    relatedInsights.forEach(r => {
      const isNews = r.guest_name === 'Lenny Rachitsky';
      const url = (!isNews && r.timestamp_secs)
        ? `${r.youtube_url}?t=${r.timestamp_secs}`
        : r.youtube_url;
      const snippet = r.pull_quote.length > 120
        ? r.pull_quote.slice(0, 120).replace(/\s+\S*$/, '') + '…'
        : r.pull_quote;

      const item = document.createElement('div');
      item.className = 'pc-related-item';
      item.innerHTML = `
        <div class="pc-related-topic">${r.topic}</div>
        <div class="pc-related-quote">${snippet}</div>
        <div class="pc-related-meta">
          <span class="pc-related-guest">${r.guest_name}</span>
          ${url ? `<a class="pc-related-link" href="${url}" target="_blank" rel="noopener noreferrer">${isNews ? '↗ Read' : '↗ Watch'}</a>` : ''}
        </div>
      `;
      relatedEl.appendChild(item);
    });
  }

  // Set mute default synchronously so audio guard works even before storage returns
  pc.dataset.muted = 'false';
  updateMuteButton(false);

  // Update from persisted preference (async — completes long before AUDIO arrives)
  chrome.storage.local.get(['voiceMuted'], (result) => {
    if (chrome.runtime.lastError) return;
    const muted = !!result.voiceMuted;
    pc.dataset.muted = String(muted);
    updateMuteButton(muted);
  });

  // Show card and start auto-dismiss
  pc.classList.remove('hidden');
  clearTimeout(autoDismissTimer);
  autoDismissTimer = setTimeout(hidePostcard, 30000);

  // Update streak on each successful insight delivery
  updateStreak();
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['streak', 'lastActiveDate'], (data) => {
    if (chrome.runtime.lastError) return;
    const last = data.lastActiveDate;
    let streak = data.streak || 0;
    if (last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      streak = (last === yesterday) ? streak + 1 : 1;
      chrome.storage.local.set({ streak, lastActiveDate: today });
    }
  });
}

function hidePostcard() {
  clearTimeout(autoDismissTimer);
  const pc = shadow.getElementById('ll-postcard');
  if (pc.classList.contains('hidden')) return; // already hidden — no-op
  pc.classList.add('ll-postcard-hiding');
  // Duration must match --ll-anim-duration (0.2s = 200ms)
  // If you change --ll-anim-duration, update this timeout to match.
  setTimeout(() => {
    pc.classList.remove('ll-postcard-hiding');
    pc.classList.add('hidden');
  }, 200);
}

function updateMuteButton(muted) {
  const btn = shadow.getElementById('ll-btn-mute');
  if (btn) btn.textContent = muted ? '🔊 Unmute' : '🔇 Mute';
}

let currentAudio = null; // held so mute button can stop in-flight audio

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function playAudio(base64) {
  const pc = shadow.getElementById('ll-postcard');
  if (pc && pc.dataset.muted === 'true') return;

  stopCurrentAudio(); // stop any previous clip before starting a new one

  // data: URIs are blocked by strict CSP on sites like Notion.
  // Convert to a Blob and use a blob: URL — allowed by "media-src blob:".
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);

  const audio = new Audio(url);
  currentAudio = audio;
  audio.play()
    .then(() => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
      };
    })
    .catch(err => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      console.warn('[LennyLive] Audio playback failed:', err.message);
    });
}

// ─── Postcard Event Listeners (set up once at load time) ──────────────────────

shadow.getElementById('ll-btn-readmore').addEventListener('click', (e) => {
  const wrapper = shadow.getElementById('ll-quote-wrapper');
  const relatedEl = shadow.getElementById('ll-related');
  if (wrapper.classList.contains('expanded')) {
    wrapper.classList.remove('expanded');
    relatedEl.classList.add('hidden');
    e.target.textContent = 'Read more';
  } else {
    wrapper.classList.add('expanded');
    // Show related only if there are items to display
    if (relatedEl.children.length > 0) {
      relatedEl.classList.remove('hidden');
    }
    e.target.textContent = 'Show less';
  }
});

shadow.getElementById('ll-postcard').addEventListener('mouseenter', () => {
  clearTimeout(autoDismissTimer);
});

shadow.getElementById('ll-postcard').addEventListener('mouseleave', () => {
  clearTimeout(autoDismissTimer);
  autoDismissTimer = setTimeout(hidePostcard, 30000);
});

shadow.getElementById('ll-btn-dismiss').addEventListener('click', () => {
  clearTimeout(autoDismissTimer);
  stopCurrentAudio();
  hidePostcard();
});

shadow.getElementById('ll-btn-mute').addEventListener('click', () => {
  const pc = shadow.getElementById('ll-postcard');
  const newMuted = pc.dataset.muted !== 'true';
  pc.dataset.muted = String(newMuted);
  updateMuteButton(newMuted);
  // Stop any currently-playing audio immediately when muting
  if (newMuted) stopCurrentAudio();
  chrome.storage.local.set({ voiceMuted: newMuted }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] voiceMuted save failed:', chrome.runtime.lastError.message);
    }
  });
});

shadow.getElementById('ll-btn-save').addEventListener('click', () => {
  if (!currentInsight) return;
  const entry = {
    topic:         currentInsight.topic,
    pull_quote:    currentInsight.pull_quote,
    guest_name:    currentInsight.guest_name,
    episode_title: currentInsight.episode_title,
    youtube_url:   currentInsight.youtube_url,
    saved_at:      new Date().toISOString(),
  };
  // Read-modify-write to avoid overwriting concurrent saves
  chrome.storage.local.get(['savedInsights'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] Save read failed:', chrome.runtime.lastError.message);
      return;
    }
    const existing = result.savedInsights || [];
    existing.push(entry);
    chrome.storage.local.set({ savedInsights: existing }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[LennyLive] Save write failed:', chrome.runtime.lastError.message);
      } else {
        console.log('[LennyLive] Insight saved:', entry.topic);
        const btn = shadow.getElementById('ll-btn-save');
        if (btn) {
          btn.textContent = '✓ Saved!';
          setTimeout(() => { btn.textContent = '🔖 Save'; }, 2000);
        }
        // Increment knowledge score +10 per saved insight
        chrome.storage.local.get(['knowledge_score'], (s) => {
          if (!chrome.runtime.lastError) {
            chrome.storage.local.set({ knowledge_score: (s.knowledge_score || 0) + 10 });
          }
        });
      }
    });
  });
});

// ─── State Machine ────────────────────────────────────────────────────────────
// States: idle | listening | loading
// Transitions: idle → listening → loading → idle
// Errors / Esc / timeout always return to idle.

let state = 'idle';

// ─── Ambient Detection State ──────────────────────────────────────────────────
// Separate from the voice state machine (idle|listening|loading).
// Tracks which ambient UI element is currently active.

let ambientState = 'none'; // 'none' | 'selection-dot' | 'write-pause-dot' | 'questions-panel'

// Write+pause sensor state
let lastPrintableKeystroke = 0;       // timestamp of last printable keydown
let lastEagerFetchBlockContent = '';  // blockContent captured at eager fetch time
let pendingQuestions = null;          // { keyword, questions, blockContent, timestamp } | null
let eagerFetchTimer = null;           // 1.5s timer → triggers Groq fetch
let dotAppearTimer = null;            // 3.5s timer → shows write+pause dot
let activeSensorElement = null;       // element the write+pause sensor is currently attached to
// API cost reduction — three gates in triggerEagerFetch
let lastEagerFetchParagraphHash = '';   // first 80 chars of last submitted paragraph
const sessionChipsCache = new Map();   // conceptKey → {keyword, questions} — survives pendingQuestions=null

// Reading sensor gate
const pageLoadTime = Date.now();      // used to enforce 20s minimum before reading sensor fires

// Returns true if the user is actively editing (typing in an input/contenteditable).
// Used to gate the reading sensor and write+pause sensor.
//
// IMPORTANT: Uses active.isContentEditable (not [contenteditable] attribute selector).
// [contenteditable] matches contenteditable="false" on Notion read-only blocks — false positives.
// isContentEditable is the DOM's computed boolean that correctly handles inheritance.
function isUserEditing() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable || active.matches('input, textarea')) return true;
  // Google Docs uses a canvas editor — activeElement is not contenteditable.
  // Fall back to: has the user pressed a printable key in the last 5 seconds?
  if (location.hostname === 'docs.google.com' && Date.now() - lastPrintableKeystroke < 5000) return true;
  return false;
}

// ─── Element-First Sensor Attachment ─────────────────────────────────────────
// Attaches the write+pause keydown listener to the specific focused element.
// This replaces the global keydown approach — sensor follows the cursor, not the URL.

function onSensorKeydown(e) {
  // Only track printable characters — ignore Ctrl, Shift, Alt, arrows, etc.
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

  lastPrintableKeystroke = Date.now();

  // User is typing — cancel any pending fetch and reset
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;
  hideWritePauseDot(); // no-op if not visible

  // Schedule fresh eager fetch 1.5s from now
  eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
}

// Paste handler — Cmd+V is filtered by onSensorKeydown (metaKey guard), so paste
// events never start the eager fetch timer. Handle separately.
function onSensorPaste() {
  lastPrintableKeystroke = Date.now();
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;
  hideWritePauseDot();
  // Give the DOM time to reflect the pasted content before reading it
  eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
}

function attachWritePauseSensor(el) {
  // Detach from previous element first (covers focus-shift without blur)
  detachWritePauseSensor();
  activeSensorElement = el;
  el.addEventListener('keydown', onSensorKeydown);
  el.addEventListener('paste', onSensorPaste);
  console.log('[LennyLive] Write+pause sensor attached to:', el.tagName, el.id || el.className.slice(0, 30));
}

function detachWritePauseSensor() {
  if (activeSensorElement) {
    activeSensorElement.removeEventListener('keydown', onSensorKeydown);
    activeSensorElement.removeEventListener('paste', onSensorPaste);
    activeSensorElement = null;
    // Cancel any pending timers — user left the field
    clearTimeout(eagerFetchTimer);
    clearTimeout(dotAppearTimer);
    console.log('[LennyLive] Write+pause sensor detached');
  }
}

// focusin fires when any element in the document gains focus (bubbles up).
// We only care about contenteditable divs and form inputs.
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el) return;
  if (el.isContentEditable || el.matches('input, textarea')) {
    attachWritePauseSensor(el);
  }
});

// focusout fires when focus leaves any element.
// Detach sensor — user is no longer typing in a monitored field.
// Do NOT hide the badge pill here — user needs to be able to click it even after
// leaving the text field. Badge persists until clicked, dismissed, or new typing starts.
document.addEventListener('focusout', () => {
  detachWritePauseSensor();
});

// ─── Ambient UI Stubs (implemented by UI agent) ───────────────────────────────

function showSelectionDot(rect) {
  // Capture selection NOW (before mousedown clears it)
  const selectedText = window.getSelection()?.toString().trim() ?? '';
  if (!selectedText) return;
  
  // Position dot just above-right of the selection
  selectionDot.style.left = `${rect.right + 4}px`;
  selectionDot.style.top = `${Math.max(0, rect.top - 16)}px`;
  selectionDot.classList.add('visible');
  
  // Important: mousedown must preventDefault to preserve selection
  selectionDot.onmousedown = (e) => {
    e.preventDefault(); 
    e.stopPropagation();
  };
  selectionDot.onclick = () => {
    chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: selectedText, pageContext: '' });
    hideSelectionDot();
  };
  
  if (ambientState !== 'selection-dot') ambientState = 'selection-dot';
}

function hideSelectionDot() {
  selectionDot.classList.remove('visible');
  if (ambientState === 'selection-dot') ambientState = 'none';
}

// Show badge pill — either loading state or ready state with question count
function showWritePauseDot(mode = 'ready') {
  const dot = shadow.getElementById('ll-badge-dot');
  const text = shadow.getElementById('ll-badge-text');
  const trigger = shadow.getElementById('ll-badge-trigger');

  if (mode === 'loading') {
    dot.className = 'll-badge-dot loading';
    text.textContent = 'Lenny is thinking...';
    trigger.onclick = null; // disabled while loading
  } else {
    // mode === 'ready'
    dot.className = 'll-badge-dot';
    const keyword = pendingQuestions?.keyword || '';
    const count = pendingQuestions?.questions?.length || 3;
    text.textContent = `${count} pattern${count !== 1 ? 's' : ''} on ${keyword}`;
    trigger.onclick = () => {
      if (ambientState === 'write-pause-dot' && pendingQuestions) {
        // Check if paragraph changed since questions were generated — re-fetch if so
        const currentHash = extractPageContext().slice(0, 80);
        if (currentHash !== lastEagerFetchParagraphHash) {
          console.log('[LennyLive] Badge clicked — paragraph drifted, re-fetching');
          showWritePauseDot('loading');
          const blockContent = extractPageContext();
          const keyword2 = detectPMKeywordInText(blockContent) || pendingQuestions.keyword;
          pendingQuestions = null;
          lastEagerFetchParagraphHash = currentHash;
          lastEagerFetchBlockContent = blockContent;
          chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword: keyword2, blockContent });
          return;
        }
        showChipsPanel(pendingQuestions.questions);
      }
    };
  }

  badgePill.classList.add('visible');
  ambientState = 'write-pause-dot';
}

function hideWritePauseDot() {
  badgePill.classList.remove('visible');
  shadow.getElementById('ll-chips-panel').classList.remove('visible');
  if (ambientState === 'write-pause-dot') ambientState = 'none';
}

function showChipsPanel(questions) {
  ambientState = 'questions-panel';
  const panel = shadow.getElementById('ll-chips-panel');

  // Build header with static innerHTML (no user-controlled variables — safe)
  panel.innerHTML = `
    <div class="ll-chips-header">
      <span class="ll-chips-title">What Lenny would ask</span>
      <button class="ll-chips-close" id="ll-chips-close-btn" type="button">✕</button>
    </div>
    <div class="ll-chips-list" id="ll-chips-list-inner"></div>
  `;

  // Build chips via DOM API — textContent prevents XSS from Groq-sourced question strings
  const list = panel.querySelector('#ll-chips-list-inner');
  questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.className = 'll-chip-btn';
    btn.dataset.idx = i;
    btn.type = 'button';
    const textSpan = document.createElement('span');
    textSpan.className = 'll-chip-btn-text';
    textSpan.textContent = q;
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'll-chip-btn-arrow';
    arrowSpan.textContent = '→';
    btn.append(textSpan, arrowSpan);
    list.appendChild(btn);
  });

  panel.classList.add('visible');

  shadow.getElementById('ll-chips-close-btn').onclick = hideAllAmbientUI;

  const chips = panel.querySelectorAll('.ll-chip-btn');
  chips.forEach(chip => {
    chip.onclick = () => {
      const idx = parseInt(chip.getAttribute('data-idx'), 10);
      fireQuestionQuery(questions[idx]);
    };
  });
}

// Called when QUESTIONS_READY arrives and dot is already showing in loading state
function updateWritePauseDotReady() {
  if (!pendingQuestions) return;
  showWritePauseDot('ready');
}

function hideAllAmbientUI() {
  hideSelectionDot();
  hideWritePauseDot(); // handles badgePill + chips panel
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;

  if (ambientState === 'questions-panel') {
    const panel = shadow.getElementById('ll-chips-panel');
    panel.classList.remove('visible');
    ambientState = 'none';
  }
}

// Called by the UI agent when a question chip is tapped.
// Fires the QUERY message with the chip text as transcript.
function fireQuestionQuery(questionText) {
  if (!pendingQuestions) return;
  // Spec requires 60s expiry — stale questions are no longer contextually relevant
  if (Date.now() - pendingQuestions.timestamp > 60000) {
    hideAllAmbientUI();
    return;
  }
  const blockContent = pendingQuestions.blockContent || '';
  hideAllAmbientUI();
  chrome.runtime.sendMessage({
    type: 'QUERY',
    transcript: questionText,
    selection: '',
    pageContext: blockContent,
  });
  console.log('[LennyLive] Question chip fired:', questionText);
}

// ─── Ping Tone (Web Audio API) ────────────────────────────────────────────────
// Double-tap Ctrl is a keydown event — qualifies as a user gesture for autoplay.

function playPing() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch (err) {
    console.log('[LennyLive] Ping audio failed (autoplay blocked):', err.message);
    // Fail silently — activation continues without sound
  }
}

// ─── Page Context Extraction ──────────────────────────────────────────────────
// Captures the semantic text the user is actually reading/writing.
// Avoids document.body.innerText — polluted with nav bars, sidebars, menus.
// Three-priority cascade: active cursor block → semantic container → title fallback.

function extractPageContext() {
  const MAX_CHARS = 500;

  // Priority 1: Active cursor block
  // If the user's cursor is inside a contenteditable, textarea, or input,
  // that element contains exactly what they're writing/editing right now.
  const active = document.activeElement;
  if (active && active !== document.body) {
    const tag = active.tagName.toLowerCase();
    const isEditable = active.isContentEditable || tag === 'textarea' || tag === 'input';
    if (isEditable) {
      let text = (active.innerText || active.value || '').trim();
      // If the block is very short, grab the parent's text for more context
      if (text.length < 100 && active.parentElement) {
        const parentText = (active.parentElement.innerText || '').trim();
        if (parentText.length > text.length) text = parentText;
      }
      if (text.length > 0) {
        console.log('[LennyLive] pageContext: active cursor block');
        return text.slice(0, MAX_CHARS);
      }
    }
  }

  // Priority 2: Semantic container
  // article, main, or [role="main"] contains the page's primary content.
  // Avoids nav/sidebar/footer noise.
  const container = document.querySelector('article, main, [role="main"]');
  if (container) {
    const text = (container.innerText || '').trim();
    if (text.length > 0) {
      console.log('[LennyLive] pageContext: semantic container');
      return text.slice(0, MAX_CHARS);
    }
  }

  // Priority 3: Title fallback
  // Last resort — page title is better than nothing (e.g. canvas-rendered pages).
  const title = document.title.trim();
  if (title) {
    console.log('[LennyLive] pageContext: title fallback');
    return title.slice(0, MAX_CHARS);
  }

  return ''; // no context available
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, durationMs = 3000) {
  clearTimeout(toastTimer);
  const t = shadow.getElementById('ll-toast');
  shadow.getElementById('ll-toast-text').textContent = message;
  t.classList.remove('fading');
  t.classList.add('visible');

  toastTimer = setTimeout(() => {
    t.classList.add('fading');
    setTimeout(() => t.classList.remove('visible', 'fading'), 150);
  }, durationMs);
}

// Friendly ascending bloop — played on chitchat/non-PM rejection.
// Two tones: low → high, conveys "acknowledged but redirecting".
function playBloop() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    [[440, 0], [660, 0.12]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    });
    setTimeout(() => ctx.close(), 600);
  } catch (_) {}
}

// Soft descending bump — played on genuine no_results (silence, off-topic).
// Single low tone: conveys "nothing found, try again".
function playBump() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

// ─── Selection Capture + Keyboard Handler ────────────────────────────────────

let lastCtrlPress = 0;
let currentSelection = '';

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();

    if (state === 'idle' && now - lastCtrlPress < 300) {
      // Double-tap Ctrl: capture selection at this moment, then activate
      currentSelection = window.getSelection().toString().trim().slice(0, 500);
      activateLennyLive();
    } else if (state === 'listening') {
      // Single tap during listening: stop capture immediately
      stopListening();
    }

    lastCtrlPress = now; // always update, regardless of state
  }

  if (e.key === 'Escape') {
    hideAllAmbientUI();   // always clear ambient UI on Escape
    if (state === 'listening' || state === 'loading') {
      cancelLennyLive();
    }
    // Also dismiss postcard if it's visible
    const pc = shadow.getElementById('ll-postcard');
    if (pc && !pc.classList.contains('hidden')) {
      stopCurrentAudio();
      hidePostcard();
    }
  }

});

// ─── Write+Pause Eager Fetch ──────────────────────────────────────────────────

// Called 1.5s after the last printable keystroke.
// Fires Groq silently to pre-generate question chips before the dot appears.
// ─── Write+Pause Eager Fetch ──────────────────────────────────────────────────
// Called 1.5s after the last printable keystroke in a monitored element.
// Three local gates run before any Groq call:
//   1. 40-word minimum — conversational messages won't trigger
//   2. PM keyword present — no keyword = nothing to surface
//   3. Paragraph hash cache — same paragraph = serve cached chips
//   4. Session concept dedup — same concept this session = serve cached chips
function triggerEagerFetch() {
  if (state !== 'idle') return;          // don't interrupt active voice session

  // Extract paragraph — two-level: cursor block first, semantic container fallback
  const blockContent = extractPageContext();
  if (!blockContent) return;

  // Gate 1: 40-word minimum — short messages are conversational, not PM work
  const wordCount = blockContent.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 40) return;

  // Gate 2: PM keyword present — fast local check, zero API cost
  let keyword = detectPMKeywordInText(blockContent);
  if (!keyword) {
    // Cursor block may be short — check semantic container for broader keyword match
    const mainEl = document.querySelector('article, main, [role="main"]');
    const mainText = mainEl ? (mainEl.innerText || '').slice(0, 5000) : '';
    keyword = mainText ? detectPMKeywordInText(mainText) : null;
  }
  if (!keyword) return;

  // Canonical concept key — "retention" and "churn" both map to "Retention" via TOPIC_MAP
  const conceptKey = TOPIC_MAP[keyword] ?? keyword;

  // Gate 3: Paragraph hash cache — same paragraph = skip regardless of pendingQuestions state.
  // pendingQuestions is cleared on every keystroke, so we can't rely on it here.
  const paragraphHash = blockContent.slice(0, 80);
  if (paragraphHash === lastEagerFetchParagraphHash) {
    const cached = sessionChipsCache.get(conceptKey);
    if (cached) {
      pendingQuestions = { ...cached, blockContent, timestamp: Date.now() };
      console.log('[LennyLive] Write+pause: paragraph unchanged — restoring cached chips');
      dotAppearTimer = setTimeout(() => { if (state !== 'idle') return; showWritePauseDot('ready'); }, 500);
    }
    return; // same paragraph, never re-fetch
  }

  // Gate 4: Session concept dedup — same canonical concept, different paragraph.
  // Restore chips from cache so Groq is not called again.
  if (sessionChipsCache.has(conceptKey)) {
    const cached = sessionChipsCache.get(conceptKey);
    pendingQuestions = { ...cached, blockContent, timestamp: Date.now() };
    lastEagerFetchParagraphHash = paragraphHash;
    lastEagerFetchBlockContent = blockContent;
    console.log('[LennyLive] Write+pause: concept cached — restoring chips without Groq call');
    dotAppearTimer = setTimeout(() => { if (state !== 'idle') return; showWritePauseDot('ready'); }, 500);
    return;
  }

  // All gates passed — proceed to Groq fetch
  lastEagerFetchParagraphHash = paragraphHash;
  lastEagerFetchBlockContent = blockContent;
  // sessionChipsCache updated in QUESTIONS_READY happy path after Groq responds

  console.log('[LennyLive] Write+pause: eager Groq fetch for keyword:', keyword, '| words:', wordCount);
  chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword, blockContent });

  // Schedule dot appearance 2s from now (= 3.5s total from last keystroke)
  dotAppearTimer = setTimeout(() => {
    if (state !== 'idle') return;
    if (pendingQuestions) {
      showWritePauseDot('ready');
    } else {
      showWritePauseDot('loading');  // questions still in flight
    }
  }, 2000);
}

// ─── Selection Sensor ─────────────────────────────────────────────────────────
// Fires when user highlights text. Shows a selection dot near the selection
// if the selected text contains a PM keyword.
// Disabled on Google Docs — getSelection() returns empty on canvas editors.

let selectionDebounceTimer = null;

document.addEventListener('selectionchange', () => {
  clearTimeout(selectionDebounceTimer);
  selectionDebounceTimer = setTimeout(() => {
    // Don't interrupt active voice session or postcard
    if (state !== 'idle') return;
    const pc = shadow.getElementById('ll-postcard');
    if (pc && !pc.classList.contains('hidden')) return;

    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    // Hide dot if selection cleared or too short/long (2000 chars ≈ ~400 words — full paragraph fine)
    if (text.length < 2 || text.length > 2000) {
      hideSelectionDot();
      return;
    }

    // Check if selection contains a PM keyword
    const hasPMKeyword = PM_BUZZWORDS.some(word => {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      return re.test(text);
    });

    if (!hasPMKeyword) {
      hideSelectionDot();
      return;
    }

    // Position dot near selection
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // empty rect (Google Docs canvas)

    ambientState = 'selection-dot';
    showSelectionDot(rect);
  }, 150); // 150ms debounce — prevents flicker during drag-select
});

// ─── Activation ───────────────────────────────────────────────────────────────

function activateLennyLive() {
  if (state !== 'idle') return;
  hideAllAmbientUI();   // clear any active ambient dots before voice activates
  state = 'listening';
  playPing();
  showIndicator('listening');
  startListening(); // defined below
}

function cancelLennyLive() {
  state = 'idle';
  clearTimeout(timerA);
  clearTimeout(timerB);
  clearTimeout(processingTimeout); // fix: was missing — could leave ghost timeout
  if (typeof recognition !== 'undefined' && recognition) {
    try { recognition.abort(); } catch (_) {}
  }
  hideIndicator();
  console.log('[LennyLive] Cancelled — returned to idle');
}

// ─── Query Processing ─────────────────────────────────────────────────────────

let processingTimeout = null;

function processQuery(transcript) {
  // currentSelection was captured at activation time — do not re-read here
  // pageContext is captured now: the active block / main content at the moment of query
  const pageContext = extractPageContext();
  state = 'loading';
  showIndicator('loading');
  console.log('[LennyLive] Sending query:', { transcript, selection: currentSelection, pageContext: pageContext.slice(0, 60) });

  // Fire-and-forget — no callback. RESPONSE arrives via chrome.runtime.onMessage listener below.
  chrome.runtime.sendMessage({
    type: 'QUERY',
    transcript,                   // field name matches service-worker expectation — do not rename
    selection: currentSelection,  // field name matches service-worker expectation — do not rename
    pageContext,                  // new: semantic page content for richer RAG context
  });

  // Safety timeout: if RESPONSE never arrives (e.g. service worker crashed),
  // return to idle after 10s so the user is never stuck.
  processingTimeout = setTimeout(() => {
    if (state === 'loading') {
      state = 'idle';
      hideIndicator();
      console.log('[LennyLive] Service worker timeout (10s) — returning to idle');
    }
  }, 10000);
}

function handleResponse(message) {
  // Cancel the safety timeout — real response arrived
  clearTimeout(processingTimeout);
  state = 'idle';
  hideIndicator();

  if (message.status === 'ok' && message.insight) {
    showPostcard(message.insight, message.relatedInsights || []);
  } else if (message.status === 'chitchat') {
    // Non-PM query — warm acknowledgement, zero ElevenLabs cost
    playBloop();
    showToast("That's outside my PM brain — try asking me about retention, pricing, growth, or any product challenge you're facing.");
    console.log('[LennyLive] Chitchat rejected — toast shown');
  } else if (message.status === 'no_results') {
    // Genuine no match — soft nudge to retry
    playBump();
    showToast("Didn't quite catch a question. Double-tap Ctrl to try again.");
    console.log('[LennyLive] No results — toast shown');
  } else if (message.status === 'network_error') {
    // Groq, ElevenLabs, or Supabase call failed — surface it immediately
    playBump();
    showToast('Network error. Lenny needs a second to reconnect.');
    console.warn('[LennyLive] Network error — toast shown');
  } else {
    console.warn('[LennyLive] Unhandled status:', message.status);
  }
}

// Single onMessage listener — handles RESPONSE (Push 1), AUDIO (Push 2), and QUESTIONS_READY
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') { handleResponse(message); }
  if (message.type === 'AUDIO')    { playAudio(message.audio); }
  if (message.type === 'QUESTIONS_READY') {
    // NOT_PM: model identified non-professional content — suppress badge silently
    if (message.notPm || (!message.error && (!message.questions || message.questions.length === 0))) {
      pendingQuestions = null;
      clearTimeout(dotAppearTimer);
      hideWritePauseDot();
      console.log('[LennyLive] QUESTIONS_READY: NOT_PM — badge suppressed');
      return;
    }

    // Groq error: fail-open — local gates already validated PM intent, don't go dark.
    // Serve template chips so the badge still appears and the chip fires the RAG pipeline.
    if (message.error) {
      const kw = message.keyword || 'this topic';
      pendingQuestions = {
        keyword: kw,
        questions: [
          `What's the most common mistake PMs make around ${kw}?`,
          `How do the best product teams think about ${kw}?`,
          `What should I know about ${kw} at my stage?`,
        ],
        blockContent: lastEagerFetchBlockContent,
        timestamp: Date.now(),
      };
      console.warn('[LennyLive] QUESTIONS_READY: Groq error — serving template chips (fail-open)');
      if (ambientState === 'write-pause-dot') updateWritePauseDotReady();
      return;
    }

    // Happy path: real chips from Groq
    pendingQuestions = {
      keyword: message.keyword,
      questions: message.questions,
      blockContent: lastEagerFetchBlockContent,
      timestamp: Date.now(),
    };

    // Cache chips so re-focus on same/related content doesn't re-call Groq
    const ck = TOPIC_MAP[message.keyword] ?? message.keyword;
    sessionChipsCache.set(ck, { keyword: message.keyword, questions: message.questions });

    console.log('[LennyLive] QUESTIONS_READY:', message.keyword, message.questions);

    if (ambientState === 'write-pause-dot') {
      updateWritePauseDotReady();
    }
  }
  // Return nothing (no return true) — we never send a response back to the SW
});

// ─── Speech Recognition ───────────────────────────────────────────────────────

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let timerA, timerB;

if (!SpeechRecognition) {
  console.warn('[LennyLive] SpeechRecognition not supported in this browser — activation disabled');
  // activateLennyLive will still run but startListening will no-op gracefully
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log('[LennyLive] Recognition started — Timer A (5s no-speech) running');
    timerA = setTimeout(() => {
      console.log('[LennyLive] Timer A fired — no speech detected, cancelling');
      cancelLennyLive();
    }, 5000);
  };

  recognition.onspeechstart = () => {
    console.log('[LennyLive] Speech detected — clearing Timer A');
    clearTimeout(timerA);
  };

  recognition.onspeechend = () => {
    console.log('[LennyLive] Speech ended — Timer B (2s post-silence) running');
    timerB = setTimeout(() => {
      console.log('[LennyLive] Timer B fired — processing query');
      // recognition.stop() triggers onresult if speech was captured
      try { recognition.stop(); } catch (_) {}
    }, 2000);
  };

  recognition.onresult = (e) => {
    clearTimeout(timerA);
    clearTimeout(timerB);
    const transcript = e.results[0][0].transcript;
    console.log('[LennyLive] Transcript:', transcript);
    processQuery(transcript);
  };

  recognition.onerror = (e) => {
    clearTimeout(timerA);
    clearTimeout(timerB);
    console.log('[LennyLive] Speech error:', e.error);
    if (e.error === 'not-allowed') {
      showMicDeniedTooltip();
    }
    cancelLennyLive();
  };

  recognition.onend = () => {
    // Fires when session ends for any reason (including natural browser termination).
    // If still in 'listening', no result was captured — return to idle.
    if (state === 'listening') {
      console.log('[LennyLive] Recognition ended without result — returning to idle');
      cancelLennyLive();
    }
  };
}

function startListening() {
  if (!recognition) {
    console.warn('[LennyLive] SpeechRecognition unavailable — cannot start listening');
    cancelLennyLive();
    return;
  }
  try {
    recognition.start();
    console.log('[LennyLive] Recognition started');
  } catch (err) {
    console.log('[LennyLive] Failed to start recognition:', err.message);
    cancelLennyLive();
  }
}

function stopListening() {
  clearTimeout(timerA);
  clearTimeout(timerB);
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
}

// ─── PM Buzzwords ─────────────────────────────────────────────────────────────
// Inlined — MV3 content scripts cannot import external modules.

// PM_ROOTS — stem-based regex for instant local detection (selection dot, reading sensor, clipboard).
// Uses word stems so morphological variants match: retent = retention/retentive,
// activat = activation/activated/activating, strateg = strategy/strategic/strategize.
// Multi-word phrases use [\s\-]+ as separators (NOT . which matches any char).
// NOTE: write+pause does NOT use this — Groq owns that detection path (Task 3).
const PM_ROOTS = /retent|retain(?!er)|churn|activat|growth[\s-]+loop|viral[\s-]+growth|acquisi|referral|network[\s-]+effect|funnel|cohort|north[\s-]+star|KPI|OKR|NPS|CSAT|DAU|MAU|WAU|LTV|CAC|ARR|MRR|product[\s-]+market|PMF|strateg|position(?:ing)?|competit|differenti|moat|roadmap|prioriti|pricing|monetiz|freemium|paywall|upsell|subscript|free[\s-]+trial|revenue[\s-]+model|onboard|aha[\s-]+moment|time[\s-]+to[\s-]+value|user[\s-]+journey|drop[\s-]+off|go[\s-]+to[\s-]+market|GTM|product[\s-]+led|PLG|sprint|backlog|epic|user[\s-]+stor|feature[\s-]+flag|dogfood|rollout|post[\s-]+mortem|user[\s-]+research|jobs[\s-]+to[\s-]+be|JTBD|A[\/\s]B[\s-]+test|experiment|persona(?!l\b)|stakehold|cross[\s-]+func|buy[\s-]+in|one[\s-]+pager|customer[\s-]+develop|feedback[\s-]+loop|feature[\s-]+request|power[\s-]+user|win[\s-]+loss|marketplac|cold[\s-]+start|MVP|zero[\s-]+to[\s-]+one|0[\s-]+to[\s-]+1|early[\s-]+stage|pre[\s-]+PMF|founding/i;

const TOPIC_MAP = {
  'retention': 'Retention', 'churn': 'Retention', 'DAU': 'Retention',
  'MAU': 'Retention', 'WAU': 'Retention', 'activation': 'Retention',
  'GTM': 'GTM Strategy', 'go-to-market': 'GTM Strategy',
  'acquisition': 'GTM Strategy', 'growth loop': 'GTM Strategy',
  'PLG': 'GTM Strategy', 'product-led': 'GTM Strategy',
  'PMF': 'Product-Market Fit', 'product market fit': 'Product-Market Fit',
  'pre-PMF': 'Product-Market Fit', 'zero to one': 'Product-Market Fit',
  '0 to 1': 'Product-Market Fit',
  'north star': 'Metrics & North Star',
  'KPI': 'Metrics & North Star', 'OKR': 'Metrics & North Star',
  'funnel': 'Metrics & North Star', 'cohort': 'Metrics & North Star',
  'conversion': 'Metrics & North Star',
  'prioritization': 'Roadmap Prioritisation', 'prioritisation': 'Roadmap Prioritisation',
  'roadmap': 'Roadmap Prioritisation', 'backlog': 'Roadmap Prioritisation',
  'strategy': 'Roadmap Prioritisation', 'positioning': 'Roadmap Prioritisation',
  'competitive': 'Roadmap Prioritisation', 'moat': 'Roadmap Prioritisation',
  'differentiation': 'Roadmap Prioritisation',
  'discovery': 'User Research', 'user research': 'User Research',
  'jobs to be done': 'User Research', 'JTBD': 'User Research',
};

function getDisplayTopic(buzzword) {
  return TOPIC_MAP[buzzword] ?? (buzzword.charAt(0).toUpperCase() + buzzword.slice(1));
}

// Quick boolean PM root check — used by selection dot, reading sensor, and clipboard intercept.
// Write+pause does NOT use this — it sends to Groq directly after the 40-word threshold.
function textMatchesPMRoot(text) {
  return PM_ROOTS.test(text.slice(0, 5000));
}

// ─── Buzzword Scanning ────────────────────────────────────────────────────────

let lastChipShownAt = 0;
const topicCooldowns = new Map(); // topic → timestamp of last chip shown

function scanForBuzzwords() {
  if (state !== 'idle') return; // never interrupt active session
  if (isUserEditing()) return;                               // NEW: skip during active editing
  if (Date.now() - pageLoadTime < 20 * 1000) return;        // NEW: 20s minimum on page

  const text = document.body.innerText.slice(0, 5000);
  const now = Date.now();

  for (const buzzword of PM_BUZZWORDS) {
    const regex = new RegExp(`\\b${buzzword}\\b`, 'i');
    if (!regex.test(text)) continue;

    const displayTopic = getDisplayTopic(buzzword);

    // General cooldown: any chip shown in last 3 minutes → skip
    if (now - lastChipShownAt < 3 * 60 * 1000) {
      console.log('[LennyLive] Buzzword match suppressed (general 3min cooldown):', buzzword);
      return;
    }

    // Per-topic cooldown: same topic shown in last 30 minutes → skip
    const topicLastShown = topicCooldowns.get(displayTopic) || 0;
    if (now - topicLastShown < 30 * 60 * 1000) {
      console.log('[LennyLive] Buzzword match suppressed (topic 30min cooldown):', displayTopic);
      continue; // try next buzzword — different topic might not be suppressed
    }

    console.log('[LennyLive] Buzzword matched:', buzzword, '→', displayTopic);
    lastChipShownAt = now;
    topicCooldowns.set(displayTopic, now);
    chrome.storage.local.set({ lastTopic: displayTopic });
    showBuzzwordChip(displayTopic);
    break; // show one chip at a time
  }
}

// ─── MutationObserver ─────────────────────────────────────────────────────────
// Fires when DOM changes (user typing). Debounced 2s to avoid thrashing.
// childList+subtree catches element additions (Notion, Linear live updates).
// characterData catches text edits in Google Docs contenteditable nodes.

let buzzwordDebounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(buzzwordDebounceTimer);
  buzzwordDebounceTimer = setTimeout(scanForBuzzwords, 2000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

console.log('[LennyLive] MutationObserver watching for PM buzzwords');

// ─── Google Docs Clipboard Intercept ─────────────────────────────────────────
// Google Docs uses a canvas renderer — getSelection() and contenteditable detection
// both fail. Fallback: intercept copy events. When a PM copies text containing a
// PM keyword on docs.google.com, treat it as a selection trigger.
//
// UX framing: "On Google Docs, highlight + copy to ask Lenny."
// This is explicitly framed as a different interaction model, not a broken version
// of the standard flow. The behavior is honest: copy is the trigger.

if (location.hostname === 'docs.google.com') {
  document.addEventListener('copy', (e) => {
    // e.clipboardData.getData only available on cut/copy events, not paste
    const clipText = e.clipboardData?.getData('text/plain')?.trim() ?? '';

    if (clipText.length < 10 || clipText.length > 2000) return;

    const keyword = detectPMKeywordInText(clipText);
    if (!keyword) return;

    console.log('[LennyLive] Google Docs clipboard intercept — keyword:', keyword, 'length:', clipText.length);

    // Treat copied text as a selection — fire QUERY directly (same as selection dot click)
    // Small delay so the copy completes before we show UI
    setTimeout(() => {
      if (state !== 'idle') return;
      chrome.runtime.sendMessage({
        type: 'QUERY',
        transcript: '',
        selection: clipText.slice(0, 500),
        pageContext: '',
      });
    }, 100);
  });

  console.log('[LennyLive] Google Docs clipboard intercept active');
}

console.log('[LennyLive] Content script loaded — Shadow DOM ready');
