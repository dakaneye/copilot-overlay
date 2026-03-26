// src/api/copilot.js
// Copilot GraphQL API client

const COPILOT_API_URL = 'https://api.copilot.money/graphql';

// GraphQL fragments from copilot-mcp
const CATEGORY_FIELDS = `
fragment CategoryFields on Category {
  isRolloverDisabled
  canBeDeleted
  isExcluded
  templateId
  colorName
  icon {
    ... on EmojiUnicode { unicode }
  }
  name
  id
}`;

const SPEND_FIELDS = `
fragment SpendMonthlyFields on CategoryMonthlySpent {
  unpaidRecurringAmount
  comparisonAmount
  amount
  month
  id
}
fragment SpendFields on CategorySpend {
  current { ...SpendMonthlyFields }
  histories { ...SpendMonthlyFields }
}`;

const BUDGET_FIELDS = `
fragment BudgetMonthlyFields on CategoryMonthlyBudget {
  unassignedRolloverAmount
  childRolloverAmount
  unassignedAmount
  resolvedAmount
  rolloverAmount
  childAmount
  goalAmount
  amount
  month
  id
}
fragment BudgetFields on CategoryBudget {
  current { ...BudgetMonthlyFields }
  histories { ...BudgetMonthlyFields }
}`;

/**
 * Fetch categories with budget and spending data
 * @param {string} token - API token
 * @returns {Promise<Array>} - List of categories with budget/spend info
 */
export async function fetchCategoriesWithBudgets(token) {
  const query = `
${CATEGORY_FIELDS}
${SPEND_FIELDS}
${BUDGET_FIELDS}
query Categories($spend: Boolean = false, $budget: Boolean = false, $rollovers: Boolean) {
  categories {
    ...CategoryFields
    spend @include(if: $spend) { ...SpendFields }
    budget(isRolloverEnabled: $rollovers) @include(if: $budget) { ...BudgetFields }
    childCategories {
      ...CategoryFields
      spend @include(if: $spend) { ...SpendFields }
      budget(isRolloverEnabled: $rollovers) @include(if: $budget) { ...BudgetFields }
    }
  }
}`;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: { spend: true, budget: true, rollovers: false },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Check for auth errors specifically
    if (response.status === 401) {
      const error = new Error(`Copilot API error: ${response.status} - ${JSON.stringify(data)}`);
      error.isAuthError = true;
      throw error;
    }
    throw new Error(`Copilot API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  // Flatten categories including children
  const allCategories = [];
  for (const cat of data.data.categories) {
    allCategories.push(cat);
    if (cat.childCategories) {
      allCategories.push(...cat.childCategories);
    }
  }

  return allCategories;
}

/**
 * Fetch budget categories (just names)
 * @param {string} token - API token
 * @returns {Promise<string[]>} - List of category names
 */
export async function fetchCategories(token) {
  const categories = await fetchCategoriesWithBudgets(token);
  return categories.map(c => c.name);
}

/**
 * Fetch all budgets as a Map
 * @param {string} token - API token
 * @returns {Promise<Map<string, {budget: number, spent: number, remaining: number}>>}
 */
export async function fetchAllBudgets(token) {
  const categories = await fetchCategoriesWithBudgets(token);

  const budgets = new Map();
  for (const cat of categories) {
    // Skip categories without budget data
    if (!cat.budget?.current) continue;

    const budgetAmount = cat.budget.current.amount || 0;
    const spentAmount = cat.spend?.current?.amount || 0;

    budgets.set(cat.name, {
      budget: budgetAmount,
      spent: spentAmount,
      remaining: budgetAmount - spentAmount,
    });
  }

  return budgets;
}
