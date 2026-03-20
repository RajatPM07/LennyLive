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

// ─── State Machine ────────────────────────────────────────────────────────────
// States: idle | listening | processing | loading
// One-directional: idle → listening → processing → loading → idle
// Errors / Esc always return to idle.

let state = 'idle';

// ─── Ping Tone (Web Audio API) ────────────────────────────────────────────────
// Double-tap Ctrl is a keydown event — qualifies as a user gesture for autoplay.

function playPing() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
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
  } catch (err) {
    console.log('[LennyLive] Ping audio failed (autoplay blocked):', err.message);
    // Fail silently — activation continues without sound
  }
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

  if (e.key === 'Escape' && state === 'listening') {
    cancelLennyLive();
  }
});

// ─── Activation ───────────────────────────────────────────────────────────────

function activateLennyLive() {
  if (state !== 'idle') return;
  state = 'listening';
  playPing();
  showIndicator('listening');
  startListening(); // defined below
}

function cancelLennyLive() {
  state = 'idle';
  clearTimeout(timerA);
  clearTimeout(timerB);
  if (typeof recognition !== 'undefined' && recognition) {
    try { recognition.abort(); } catch (_) {}
  }
  hideIndicator();
  console.log('[LennyLive] Cancelled — returned to idle');
}

// ─── Query Processing ─────────────────────────────────────────────────────────

let processingTimeout = null;

function processQuery(transcript) {
  state = 'processing';
  showIndicator('thinking');
  console.log('[LennyLive] Sending query:', { transcript, selection: currentSelection });

  chrome.runtime.sendMessage(
    { type: 'QUERY', transcript, selection: currentSelection },
    (response) => {
      clearTimeout(processingTimeout);

      if (!response) {
        console.log('[LennyLive] No response from service worker — returning to idle');
        cancelLennyLive();
        return;
      }

      console.log('[LennyLive] Response received:', response);
      state = 'loading';
      showIndicator('loading');

      // Sub-project 4 renders postcard here.
      // For sub-project 1: return to idle after short delay.
      setTimeout(() => {
        state = 'idle';
        hideIndicator();
        console.log('[LennyLive] Returned to idle after stub response');
      }, 500);
    }
  );

  // Safety timeout: return to idle if service worker never responds
  processingTimeout = setTimeout(() => {
    if (state === 'processing' || state === 'loading') {
      console.log('[LennyLive] Service worker timeout (10s) — returning to idle');
      cancelLennyLive();
    }
  }, 10000);
}

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

const PM_BUZZWORDS = [
  'retention', 'churn', 'DAU', 'MAU', 'WAU', 'activation',
  'conversion', 'funnel', 'cohort', 'ARR', 'MRR', 'ARPU',
  'LTV', 'CAC', 'NPS', 'CSAT', 'north star', 'KPI', 'OKR',
  'PMF', 'product market fit', 'GTM', 'go-to-market', 'roadmap',
  'prioritization', 'prioritisation', 'discovery', 'strategy',
  'positioning', 'competitive', 'moat', 'differentiation',
  'growth loop', 'viral', 'acquisition', 'referral', 'PLG',
  'product-led', 'MVP', 'launch', 'zero to one', '0 to 1',
  'early stage', 'pre-PMF', 'founding', 'user research',
  'jobs to be done', 'JTBD', 'A/B test', 'experiment',
  'stakeholder', 'cross-functional'
];

const TOPIC_MAP = {
  'retention': 'Retention', 'churn': 'Retention', 'DAU': 'Retention',
  'MAU': 'Retention', 'WAU': 'Retention', 'activation': 'Retention',
  'GTM': 'GTM Strategy', 'go-to-market': 'GTM Strategy',
  'acquisition': 'GTM Strategy', 'growth loop': 'GTM Strategy',
  'PLG': 'GTM Strategy', 'product-led': 'GTM Strategy',
  'PMF': 'Product-Market Fit', 'product market fit': 'Product-Market Fit',
  'pre-PMF': 'Product-Market Fit', 'zero to one': 'Product-Market Fit',
  '0 to 1': 'Product-Market Fit',
};

function getDisplayTopic(buzzword) {
  return TOPIC_MAP[buzzword] ?? (buzzword.charAt(0).toUpperCase() + buzzword.slice(1));
}

// ─── Buzzword Scanning ────────────────────────────────────────────────────────

let lastChipShownAt = 0;
const topicCooldowns = new Map(); // topic → timestamp of last chip shown

function scanForBuzzwords() {
  if (state !== 'idle') return; // never interrupt active session

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

console.log('[LennyLive] Content script loaded — Shadow DOM ready');
