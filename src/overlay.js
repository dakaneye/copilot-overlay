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

  if (data.offline || data.error === 'offline') {
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
 * Find the order summary container by walking up from the target element.
 * Looks for elements with summary/cart/order in their class or id.
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function findSummaryContainer(element) {
  let current = element;

  // Walk up to find a container that looks like an order summary (max 10 levels)
  for (let i = 0; i < 10; i++) {
    const parent = current.parentElement;
    if (!parent || parent === document.body) break;

    const className = (parent.className || '').toLowerCase();
    const id = (parent.id || '').toLowerCase();
    const testId = (parent.getAttribute('data-testid') || '').toLowerCase();
    const anchorId = (parent.getAttribute('data-anchor-id') || '').toLowerCase();

    // Look for summary/cart/order containers
    const identifiers = className + ' ' + id + ' ' + testId + ' ' + anchorId;
    if (identifiers.match(/summary|cart|order|checkout|subtotal|total/)) {
      // Found a likely container - but keep going to find the outermost one
      current = parent;
      continue;
    }

    // If we found a container and hit a non-matching parent, stop
    if (current !== element) {
      return current;
    }

    current = parent;
  }

  return current;
}

/**
 * Inject overlay below target element
 * @param {HTMLElement} targetElement
 * @param {object} data - Budget data
 */
export function injectOverlay(targetElement, data) {
  removeOverlay();
  const overlay = createOverlay(data);

  // Find the order summary container and append to it
  const container = findSummaryContainer(targetElement);
  container.appendChild(overlay);
}
