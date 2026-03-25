// src/popup.js
// Popup logic: status display, settings link

async function checkStatus() {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response.connected) {
      statusIcon.className = 'popup__status-icon popup__status-icon--connected';
      statusText.textContent = 'Connected to Copilot';
    } else {
      statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
      if (response.reason === 'no_token') {
        statusText.textContent = 'Not configured';
      } else {
        statusText.textContent = 'Connection error';
      }
    }
  } catch (error) {
    statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
    statusText.textContent = 'Error';
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

// Check status on load
checkStatus();
