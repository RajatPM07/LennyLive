// popup/popup.js
// Dashboard — PM Level, Knowledge Map, Topic-Grouped Insights, Search
// Storage keys: streak, lastActiveDate, longest_streak, knowledge_score, savedInsights, topicCounts, voiceMuted, hasOnboarded, streakShield

// PM Career Ladder (PRD v2 §2.1)
const LEVELS = [
  { min: 0,    title: 'Intern' },
  { min: 50,   title: 'APM' },
  { min: 150,  title: 'PM' },
  { min: 350,  title: 'Senior PM' },
  { min: 700,  title: 'Staff PM' },
  { min: 1200, title: 'Group PM' },
];

function getLevel(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) level = l;
    else break;
  }
  return level;
}

function getNextLevel(xp) {
  for (const l of LEVELS) {
    if (xp < l.min) return l;
  }
  return null; // max level
}

document.addEventListener('DOMContentLoaded', () => {
  const teachingEl  = document.getElementById('teaching-state');
  const dashboardEl = document.getElementById('dashboard');

  // ─── Routing: teaching state vs dashboard ─────────────────────
  chrome.storage.local.get(['hasOnboarded'], (data) => {
    if (!data.hasOnboarded) {
      teachingEl.classList.remove('hidden');
      dashboardEl.style.display = 'none';
    } else {
      teachingEl.classList.add('hidden');
      dashboardEl.style.display = 'block';
      loadDashboard();
    }
  });

  // ─── Teaching CTA ─────────────────────────────────────────────
  document.getElementById('teaching-cta').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'NUDGE_PULSE' });
      }
      setTimeout(() => window.close(), 100);
    });
  });

  // ─── Dashboard ────────────────────────────────────────────────
  function loadDashboard() {
    chrome.storage.local.get(
      ['streak', 'knowledge_score', 'savedInsights', 'voiceMuted', 'topicCounts', 'streakShield', 'longest_streak'],
      (data) => {
        renderStats(data);
        renderKnowledgeMap(data.topicCounts || {});
        renderSavedInsights(data.savedInsights || []);
        setupSearch(data.savedInsights || []);
        setupMuteToggle(data.voiceMuted);
      }
    );
  }

  function renderStats(data) {
    const xp = data.knowledge_score || 0;
    const streak = data.streak || 0;
    const level = getLevel(xp);
    const next = getNextLevel(xp);

    document.getElementById('streak-value').textContent = streak;
    document.getElementById('score-value').textContent = xp;
    document.getElementById('level-title').textContent = level.title;

    // Shield indicator
    const shieldEl = document.getElementById('streak-shield');
    if (data.streakShield) shieldEl.textContent = '🛡 Shield';

    // "47 → Senior PM"
    const progressEl = document.getElementById('level-progress');
    if (next) {
      progressEl.textContent = `${next.min - xp} → ${next.title}`;
    } else {
      progressEl.textContent = 'Max level!';
    }
  }

  function renderKnowledgeMap(topicCounts) {
    const mapEl = document.getElementById('knowledge-map');
    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      mapEl.innerHTML = '<p class="no-results-text">Save insights to build your knowledge map.</p>';
      return;
    }

    mapEl.innerHTML = sorted.map(([topic, count]) => {
      const maxBars = 5;
      const filled = Math.min(count, maxBars);
      const bars = Array.from({ length: maxBars }, (_, i) =>
        `<div class="km-bar${i < filled ? ' filled' : ''}"></div>`
      ).join('');
      const check = count >= maxBars ? '✓' : '';
      return `
        <div class="km-row">
          <div class="km-bars">${bars}</div>
          <span class="km-label">${topic}</span>
          <span class="km-count">${count}</span>
          ${check ? `<span class="km-check">${check}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderSavedInsights(insights, filter = '') {
    const listEl = document.getElementById('saved-list');
    const emptyEl = document.getElementById('empty-state');

    // Remove old dynamic content
    listEl.querySelectorAll('.topic-group, .no-results-text').forEach(g => g.remove());

    if (insights.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Filter
    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? insights.filter(i =>
          (i.topic || '').toLowerCase().includes(lowerFilter) ||
          (i.guest_name || '').toLowerCase().includes(lowerFilter) ||
          (i.pull_quote || '').toLowerCase().includes(lowerFilter)
        )
      : insights;

    // Group by topic
    const groups = {};
    filtered.forEach(insight => {
      const topic = insight.topic || 'PM Insights';
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(insight);
    });

    // Sort groups by count descending
    const sortedTopics = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    if (sortedTopics.length === 0 && filter) {
      const noRes = document.createElement('p');
      noRes.className = 'no-results-text';
      noRes.textContent = 'No matching insights.';
      listEl.appendChild(noRes);
      return;
    }

    sortedTopics.forEach(([topic, items]) => {
      const group = document.createElement('div');
      group.className = 'topic-group';

      const header = document.createElement('div');
      header.className = 'topic-header';
      header.innerHTML = `
        <span class="topic-name">${topic}</span>
        <span><span class="topic-count">(${items.length})</span> <span class="topic-arrow">▸</span></span>
      `;
      header.addEventListener('click', () => group.classList.toggle('expanded'));

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'topic-items';

      // Sort items newest first
      items.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));

      items.forEach(insight => {
        const item = document.createElement('div');
        item.className = 'saved-item';

        const ytUrl = insight.youtube_url
          ? (insight.timestamp_secs
              ? `${insight.youtube_url}?t=${insight.timestamp_secs}`
              : insight.youtube_url)
          : null;

        item.innerHTML = `
          <div class="item-content">
            <div class="item-title">${insight.pull_quote || insight.topic || 'Saved Insight'}</div>
            <div class="item-meta">From ${insight.guest_name || 'Lenny Rachitsky'}</div>
          </div>
          ${ytUrl ? '<div class="item-arrow">↗</div>' : ''}
        `;

        if (ytUrl) {
          item.title = 'Open source episode';
          item.addEventListener('click', () => chrome.tabs.create({ url: ytUrl }));
        }

        itemsDiv.appendChild(item);
      });

      group.appendChild(header);
      group.appendChild(itemsDiv);
      listEl.appendChild(group);
    });
  }

  function setupSearch(insights) {
    const searchEl = document.getElementById('search-bar');
    if (!searchEl) return;
    let debounceTimer;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderSavedInsights(insights, searchEl.value.trim());
      }, 150);
    });
  }

  function setupMuteToggle(muted) {
    const muteCheckbox = document.getElementById('mute-checkbox');
    if (muted) muteCheckbox.checked = true;
    muteCheckbox.addEventListener('change', (e) => {
      const newMuted = e.target.checked;
      chrome.storage.local.set({ voiceMuted: newMuted });
      // Send MUTE_CHANGED to active tab so audio stops immediately (PRD v2 §4.5)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'MUTE_CHANGED', muted: newMuted });
        }
      });
    });
  }
});
