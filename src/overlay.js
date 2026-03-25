// src/overlay.js
// Creates and updates the budget overlay DOM element

const OVERLAY_ID = 'copilot-budget-overlay';

/**
 * Determine visual state based on budget status
 * @param {number} spent
 * @param {number} budget
 * @returns {'normal' | 'warning' | 'over'}
 */
function getVisualState(spent, budget) {
  if (spent > budget) return 'over';
  const remaining = budget - spent;
  const percentRemaining = remaining / budget;
  if (percentRemaining < 0.3) return 'warning';
  return 'normal';
}

/**
 * Format currency amount
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Create the overlay element
 * @param {object} data - Budget data
 * @param {string} data.category
 * @param {number} data.budget
 * @param {number} data.spent
 * @param {number} data.remaining
 * @param {boolean} [data.offline]
 * @param {boolean} [data.noBudget]
 * @returns {HTMLElement}
 */
export function createOverlay(data) {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'copilot-budget-overlay';

  if (data.offline) {
    overlay.classList.add('copilot-budget-overlay--offline');
    overlay.innerHTML = `
      <div class="copilot-budget-overlay__content">
        <div class="copilot-budget-overlay__left">
          <div class="copilot-budget-overlay__category">${data.category} Budget</div>
          <div class="copilot-budget-overlay__remaining">Offline</div>
        </div>
        <div class="copilot-budget-overlay__right">
          <div class="copilot-budget-overlay__spent">Using cached data</div>
        </div>
      </div>
    `;
    return overlay;
  }

  if (data.noBudget) {
    overlay.classList.add('copilot-budget-overlay--no-budget');
    overlay.innerHTML = `
      <div class="copilot-budget-overlay__content">
        <div class="copilot-budget-overlay__left">
          <div class="copilot-budget-overlay__category">${data.category}</div>
          <div class="copilot-budget-overlay__remaining">No budget set</div>
        </div>
      </div>
    `;
    return overlay;
  }

  const state = getVisualState(data.spent, data.budget);
  overlay.classList.add(`copilot-budget-overlay--${state}`);

  const remainingText = data.remaining >= 0
    ? `${formatCurrency(data.remaining)} remaining`
    : `${formatCurrency(Math.abs(data.remaining))} over`;

  overlay.innerHTML = `
    <div class="copilot-budget-overlay__content">
      <div class="copilot-budget-overlay__left">
        <div class="copilot-budget-overlay__category">${data.category} Budget</div>
        <div class="copilot-budget-overlay__remaining">${remainingText}</div>
      </div>
      <div class="copilot-budget-overlay__right">
        <div class="copilot-budget-overlay__spent">${formatCurrency(data.spent)} of ${formatCurrency(data.budget)}</div>
        <div class="copilot-budget-overlay__period">this month</div>
      </div>
    </div>
  `;

  return overlay;
}

/**
 * Update existing overlay with new data
 * @param {object} data - Budget data
 */
export function updateOverlay(data) {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    const newOverlay = createOverlay(data);
    existing.replaceWith(newOverlay);
  }
}

/**
 * Remove overlay from page
 */
export function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Inject overlay below target element
 * @param {HTMLElement} targetElement
 * @param {object} data - Budget data
 */
export function injectOverlay(targetElement, data) {
  removeOverlay();
  const overlay = createOverlay(data);
  targetElement.insertAdjacentElement('afterend', overlay);
}
