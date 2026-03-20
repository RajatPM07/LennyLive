// content/content-script.js
// Detection + Shadow DOM UI injection for Lenny Live.
// MV3 content scripts cannot use ES modules — this is one intentionally long file.

// ─── Shadow DOM Setup ────────────────────────────────────────────────────────

const host = document.createElement('div');
host.id = 'lenny-live-root';
const shadow = host.attachShadow({ mode: 'open' }); // open = inspectable in DevTools
document.body.appendChild(host);

// Inject all styles into shadow root
const style = document.createElement('style');
style.textContent = `
  /* ── Listening Indicator ── */
  #ll-indicator {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 24px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #fff;
    z-index: 2147483647;
    pointer-events: none;
  }
  #ll-indicator.hidden { display: none !important; }

  #ll-dot {
    width: 8px;
    height: 8px;
    background: #a78bfa;
    border-radius: 50%;
    flex-shrink: 0;
    animation: ll-pulse 1.5s infinite;
  }
  #ll-indicator.loading #ll-dot { animation: none; }

  /* Skeleton shimmer for loading state */
  #ll-indicator.loading #ll-text {
    background: linear-gradient(90deg, #333 25%, #555 50%, #333 75%);
    background-size: 200% 100%;
    animation: ll-shimmer 1.2s infinite;
    border-radius: 4px;
    color: transparent;
    min-width: 140px;
    height: 14px;
  }

  @keyframes ll-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.3); }
  }
  @keyframes ll-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Mic Denied Tooltip ── */
  #ll-tooltip {
    display: none;
    position: fixed;
    bottom: 80px;
    right: 32px;
    background: #1a1a1a;
    border: 1px solid #ef4444;
    border-radius: 12px;
    padding: 8px 14px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #fca5a5;
    z-index: 2147483647;
    pointer-events: none;
    max-width: 260px;
  }
  #ll-tooltip.visible { display: block; }

  /* ── Buzzword Chip ── */
  #ll-chip {
    display: none;
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1));
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 12px;
    padding: 10px 16px;
    align-items: center;
    gap: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #e5e7eb;
    z-index: 2147483647;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
    opacity: 0;
    white-space: nowrap;
  }
  #ll-chip.visible {
    display: flex;
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  #ll-chip.fading {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }

  #ll-chip-dot {
    width: 6px;
    height: 6px;
    background: #a78bfa;
    border-radius: 50%;
    flex-shrink: 0;
    animation: ll-pulse 1.5s infinite;
  }
  #ll-chip-topic { color: #a78bfa; font-weight: 600; }
`;
shadow.appendChild(style);

// Create indicator
const indicator = document.createElement('div');
indicator.id = 'll-indicator';
indicator.className = 'hidden';
indicator.innerHTML = '<div id="ll-dot"></div><span id="ll-text">Lenny is listening...</span>';
shadow.appendChild(indicator);

// Create mic denied tooltip
const tooltip = document.createElement('div');
tooltip.id = 'll-tooltip';
tooltip.textContent = 'Mic access needed — click the lock icon in your address bar.';
shadow.appendChild(tooltip);

// Create buzzword chip
const chip = document.createElement('div');
chip.id = 'll-chip';
chip.innerHTML = '<div id="ll-chip-dot"></div><span>Lenny on <span id="ll-chip-topic"></span> →</span>';
shadow.appendChild(chip);

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

console.log('[LennyLive] Content script loaded — Shadow DOM ready');
