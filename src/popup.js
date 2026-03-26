// src/popup.js
// Popup logic: status display, auth status, settings link

async function checkStatus() {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const setupInstructions = document.getElementById('setup-instructions');
  const loginBtn = document.getElementById('login-btn');

  try {
    // Read directly from storage instead of messaging
    const storage = await chrome.storage.local.get(['copilotToken']);

    // Simple status based on token presence
    const hasToken = !!storage.copilotToken;
    const authStatus = { authMode: hasToken ? 'native' : 'manual' };
    const response = { connected: hasToken };

    if (authStatus.loginInProgress) {
      statusIcon.className = 'popup__status-icon popup__status-icon--loading';
      statusText.textContent = 'Authenticating...';
      statusDetail.textContent = 'Logging in via browser';
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'none';
      return;
    }

    if (authStatus.authMode === 'native') {
      if (response.connected) {
        statusIcon.className = 'popup__status-icon popup__status-icon--connected';
        statusText.textContent = 'Connected';

        if (authStatus.nativeTokenExpiresAt > 0) {
          const mins = Math.round((authStatus.nativeTokenExpiresAt - Date.now()) / 60000);
          statusDetail.textContent = mins > 0 ? `Token expires in ${mins}m` : 'Token expired';
        } else {
          statusDetail.textContent = '';
        }

        loginBtn.style.display = 'none';
        setupInstructions.style.display = 'none';
      } else {
        statusIcon.className = 'popup__status-icon popup__status-icon--warning';
        statusText.textContent = 'Not authenticated';
        statusDetail.textContent = '';
        loginBtn.style.display = 'inline-block';
        setupInstructions.style.display = 'none';
      }
    } else if (authStatus.authMode === 'manual') {
      if (response.connected) {
        statusIcon.className = 'popup__status-icon popup__status-icon--connected';
        statusText.textContent = 'Connected (Manual)';
        statusDetail.textContent = 'Using manually entered token';
      } else {
        statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
        statusText.textContent = 'Not configured';
        statusDetail.textContent = '';
      }
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'block';
    } else {
      // Unknown auth mode - still initializing
      statusIcon.className = 'popup__status-icon popup__status-icon--loading';
      statusText.textContent = 'Initializing...';
      statusDetail.textContent = '';
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'none';
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

async function triggerLogin() {
  const loginBtn = document.getElementById('login-btn');
  loginBtn.textContent = 'Logging in...';
  loginBtn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: 'TRIGGER_LOGIN' });
    // Poll for status changes
    const pollStatus = setInterval(async () => {
      await checkStatus();
      const authStatus = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
      if (!authStatus.loginInProgress) {
        clearInterval(pollStatus);
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
      }
    }, 1000);
  } catch {
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
  }
}

function getInstallCommand() {
  const extensionId = chrome.runtime.id;
  return `cd native-host && ./install.sh --extension-id=${extensionId} && npm install`;
}

function copyCommand() {
  navigator.clipboard.writeText(getInstallCommand());
  const copyBtn = document.getElementById('copy-cmd-btn');
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
  }, 2000);
}

// Set up dynamic install command
document.getElementById('setup-code').textContent = getInstallCommand();

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('refresh-btn').addEventListener('click', refreshCache);
document.getElementById('login-btn').addEventListener('click', triggerLogin);
document.getElementById('copy-cmd-btn').addEventListener('click', copyCommand);

// Check status on load - delay to let service worker start
setTimeout(checkStatus, 100);
