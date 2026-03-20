// popup/popup.js
// Reads chrome.storage.local on open and renders. No writes.

chrome.storage.local.get(['lastTopic'], (result) => {
  const lastTopicEl = document.getElementById('last-topic');
  if (result.lastTopic) {
    lastTopicEl.textContent = result.lastTopic;
  }
});
