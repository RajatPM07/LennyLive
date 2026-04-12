// popup/popup.js
// Reads from chrome.storage.local on open to populate the dashboard.
// Storage keys used: streak, lastActiveDate, knowledge_score, savedInsights, voiceMuted
// NOTE: hasOnboarded is no longer read here — onboarding now lives in content-script.js.

document.addEventListener('DOMContentLoaded', () => {
  const streakEl     = document.getElementById('streak-value');
  const scoreEl      = document.getElementById('score-value');
  const savedListEl  = document.getElementById('saved-list');
  const muteCheckbox = document.getElementById('mute-checkbox');

  // ─── Dashboard ─────────────────────────────────────────────────
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
    // If savedInsights is empty or missing, the empty-state-card from HTML remains visible.
  });

  // Mute toggle — persists across popup opens
  muteCheckbox.addEventListener('change', (e) => {
    chrome.storage.local.set({ voiceMuted: e.target.checked });
  });
});
