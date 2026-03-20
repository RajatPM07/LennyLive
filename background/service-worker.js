// background/service-worker.js
// Stub message hub — receives messages from content script, echoes back.
// Sub-project 2 replaces this with the real RAG pipeline.
//
// MV3 constraint: service workers can be terminated by Chrome at any time.
// This stub responds synchronously so termination is not a concern.
// Sub-project 2 must choose: keep sync OR switch to push model
// (service worker calls chrome.tabs.sendMessage back instead of sendResponse).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LennyLive] Message received:', message.type, message);

  if (message.type === 'QUERY') {
    // Stub: echo back empty response. Sub-project 2 replaces with RAG + ElevenLabs.
    sendResponse({ type: 'RESPONSE', status: 'ok', insight: null });
  }

  if (message.type === 'BUZZWORD_TRIGGERED') {
    // Stub: acknowledge. Sub-project 2 may pre-fetch related insights here.
    sendResponse({ type: 'ACK' });
  }

  return true; // keeps the message port open for sendResponse
});
