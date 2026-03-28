// popup/popup.js
// Reads from chrome.storage.local on open to populate the dashboard

document.addEventListener('DOMContentLoaded', () => {
  const streakEl = document.getElementById('streak-value');
  const scoreEl = document.getElementById('score-value');
  const savedListEl = document.getElementById('saved-list');
  const muteCheckbox = document.getElementById('mute-checkbox');

  chrome.storage.local.get(['streak', 'knowledge_score', 'savedInsights', 'voiceMuted'], (data) => {
    // 1. Gamification
    if (data.streak !== undefined) streakEl.textContent = data.streak;
    if (data.knowledge_score !== undefined) scoreEl.textContent = data.knowledge_score;

    // 2. Mute Toggle
    if (data.voiceMuted) muteCheckbox.checked = true;

    // 3. Saved Insights list
    if (data.savedInsights && data.savedInsights.length > 0) {
      savedListEl.innerHTML = ''; // clear empty state
      
      const recent = data.savedInsights.slice(-5).reverse();
      
      recent.forEach(insight => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'saved-item';
        
        itemDiv.innerHTML = `
          <div class="item-icon">📄</div>
          <div class="item-content">
            <div class="item-title">${insight.topic || 'Saved Insight'}</div>
            <div class="item-meta">From ${insight.guest_name || 'Lenny Rachitsky'}</div>
          </div>
        `;
        savedListEl.appendChild(itemDiv);
      });
    }
  });

  // Handle mute toggle changes globally
  muteCheckbox.addEventListener('change', (e) => {
    chrome.storage.local.set({ voiceMuted: e.target.checked });
  });
});
