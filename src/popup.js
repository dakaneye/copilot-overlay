// src/popup.js
// Popup logic: status display, auth status, settings link

async function checkStatus() {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const setupInstructions = document.getElementById('setup-instructions');

  try {
    // Read directly from storage instead of messaging
    const storage = await chrome.storage.local.get(['copilotToken']);

    // Simple status based on token presence
    const hasToken = !!storage.copilotToken;

    if (hasToken) {
      statusIcon.className = 'popup__status-icon popup__status-icon--connected';
      statusText.textContent = 'Connected';
      statusDetail.textContent = '';
      setupInstructions.style.display = 'none';
    } else {
      statusIcon.className = 'popup__status-icon popup__status-icon--warning';
      statusText.textContent = 'Not authenticated';
      statusDetail.textContent = '';
      setupInstructions.style.display = 'block';
    }
  } catch (error) {
    statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
    statusText.textContent = 'Error';
    statusDetail.textContent = error.message;
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function refreshCache() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.textContent = 'Refreshing...';
  refreshBtn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: 'REFRESH_CACHE' });
    await checkStatus();
  } finally {
    refreshBtn.textContent = 'Refresh';
    refreshBtn.disabled = false;
  }
}

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('refresh-btn').addEventListener('click', refreshCache);

// Check status on load - delay to let service worker start
setTimeout(checkStatus, 100);
