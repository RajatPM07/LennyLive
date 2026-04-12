// popup/popup.js
// Reads from chrome.storage.local on open to populate the dashboard.
// Storage keys used: streak, lastActiveDate, knowledge_score, savedInsights, voiceMuted, hasOnboarded

document.addEventListener('DOMContentLoaded', () => {
  const teachingEl  = document.getElementById('teaching-state');
  const dashboardEl = document.getElementById('dashboard');

  // ─── Routing: teaching state vs dashboard ─────────────────────
  chrome.storage.local.get(['hasOnboarded'], (data) => {
    if (!data.hasOnboarded) {
      // First-time user: show teaching state, hide dashboard
      teachingEl.classList.remove('hidden');
      dashboardEl.style.display = 'none';
    } else {
      // Returning user: show dashboard
      teachingEl.classList.add('hidden');
      dashboardEl.style.display = 'block';
      loadDashboard();
    }
  });

  // ─── Teaching CTA: "Got it, let me try" ────────────────────────
  document.getElementById('teaching-cta').addEventListener('click', () => {
    // Send NUDGE_PULSE to the active tab's content script so the nudge dot pulses
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'NUDGE_PULSE' });
      }
      // Small delay to let the message dispatch before popup closes
      setTimeout(() => window.close(), 100);
    });
  });

  // ─── Dashboard ─────────────────────────────────────────────────
  function loadDashboard() {
    const streakEl     = document.getElementById('streak-value');
    const scoreEl      = document.getElementById('score-value');
    const savedListEl  = document.getElementById('saved-list');
    const muteCheckbox = document.getElementById('mute-checkbox');

    chrome.storage.local.get(['streak', 'knowledge_score', 'savedInsights', 'voiceMuted'], (data) => {
      // 1. Gamification stats
      if (data.streak !== undefined) streakEl.textContent = data.streak;
      if (data.knowledge_score !== undefined) scoreEl.textContent = data.knowledge_score;

      // 2. Mute toggle
      if (data.voiceMuted) muteCheckbox.checked = true;

      // 3. Saved insights — most recent 5, clickable to YouTube at exact timestamp
      if (data.savedInsights && data.savedInsights.length > 0) {
        savedListEl.innerHTML = '';
        const recent = data.savedInsights.slice(-5).reverse();

        recent.forEach(insight => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'saved-item';

          const ytUrl = insight.youtube_url
            ? (insight.timestamp_secs
                ? `${insight.youtube_url}?t=${insight.timestamp_secs}`
                : insight.youtube_url)
            : null;

          itemDiv.innerHTML = `
            <div class="item-icon">📄</div>
            <div class="item-content">
              <div class="item-title">${insight.topic || 'Saved Insight'}</div>
              <div class="item-meta">From ${insight.guest_name || 'Lenny Rachitsky'}</div>
            </div>
            ${ytUrl ? '<div class="item-arrow">↗</div>' : ''}
          `;

          if (ytUrl) {
            itemDiv.title = 'Open source episode';
            itemDiv.addEventListener('click', () => chrome.tabs.create({ url: ytUrl }));
          }

          savedListEl.appendChild(itemDiv);
        });
      }
    });

    // Mute toggle — persists across popup opens
    document.getElementById('mute-checkbox').addEventListener('change', (e) => {
      chrome.storage.local.set({ voiceMuted: e.target.checked });
    });
  }
});
