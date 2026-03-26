// src/settings.js
// Settings page logic

let categories = [];
let domainMappings = {};

async function loadSettings() {
  const result = await chrome.storage.local.get([
    'claudeKey',
    'enabled',
    'domainMappings',
    'categories',
  ]);

  document.getElementById('claude-key').value = result.claudeKey || '';
  document.getElementById('enabled').checked = result.enabled !== false;

  domainMappings = result.domainMappings || {};
  categories = result.categories || [];

  renderOverrides();
  populateCategorySelect();
}

function populateCategorySelect() {
  const select = document.getElementById('new-category');
  select.innerHTML = '<option value="">Select category</option>';

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

function renderOverrides() {
  const container = document.getElementById('overrides-list');
  container.innerHTML = '';

  for (const [domain, category] of Object.entries(domainMappings)) {
    const item = document.createElement('div');
    item.className = 'settings__override-item';
    item.innerHTML = `
      <span class="settings__override-domain">${domain}</span>
      <span class="settings__override-arrow">-></span>
      <span class="settings__override-category">${category}</span>
      <button class="settings__override-remove" data-domain="${domain}">x</button>
    `;
    container.appendChild(item);
  }

  // Add remove listeners
  container.querySelectorAll('.settings__override-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.dataset.domain;
      delete domainMappings[domain];
      renderOverrides();
    });
  });
}

function addOverride() {
  const domainInput = document.getElementById('new-domain');
  const categorySelect = document.getElementById('new-category');

  const domain = domainInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  if (!domain || !category) {
    return;
  }

  domainMappings[domain] = category;
  domainInput.value = '';
  categorySelect.value = '';
  renderOverrides();
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');

  saveBtn.disabled = true;
  saveStatus.textContent = 'Saving...';

  try {
    await chrome.storage.local.set({
      claudeKey: document.getElementById('claude-key').value,
      enabled: document.getElementById('enabled').checked,
      domainMappings,
    });

    // Refresh cache
    await chrome.runtime.sendMessage({ type: 'REFRESH_CACHE' });

    saveStatus.textContent = 'Saved!';
    saveStatus.className = 'settings__save-status settings__save-status--success';
  } catch (error) {
    saveStatus.textContent = 'Error saving';
    saveStatus.className = 'settings__save-status settings__save-status--error';
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  }
}

document.getElementById('add-override-btn').addEventListener('click', addOverride);
document.getElementById('save-btn').addEventListener('click', saveSettings);

// Load settings on page load
loadSettings();
