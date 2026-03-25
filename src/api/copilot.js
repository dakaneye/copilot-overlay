// src/api/copilot.js
// Copilot GraphQL API client

const COPILOT_API_URL = 'https://api.copilot.money/graphql';

/**
 * Fetch budget categories from Copilot
 * @param {string} token - API token
 * @returns {Promise<string[]>} - List of category names
 */
export async function fetchCategories(token) {
  const query = `
    query GetCategories {
      categories {
        name
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  return data.data.categories.map(c => c.name);
}

/**
 * Fetch budget data for a category
 * @param {string} token - API token
 * @param {string} category - Category name
 * @returns {Promise<{category: string, budget: number, spent: number, remaining: number} | null>}
 */
export async function fetchBudget(token, category) {
  const query = `
    query GetBudget($category: String!) {
      budget(category: $category) {
        category
        budgetAmount
        spentAmount
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: { category },
    }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  const budget = data.data.budget;
  if (!budget) {
    return null;
  }

  return {
    category: budget.category,
    budget: budget.budgetAmount,
    spent: budget.spentAmount,
    remaining: budget.budgetAmount - budget.spentAmount,
  };
}

/**
 * Fetch all budgets
 * @param {string} token - API token
 * @returns {Promise<Map<string, {budget: number, spent: number, remaining: number}>>}
 */
export async function fetchAllBudgets(token) {
  const query = `
    query GetAllBudgets {
      budgets {
        category
        budgetAmount
        spentAmount
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  const budgets = new Map();
  for (const b of data.data.budgets) {
    budgets.set(b.category, {
      budget: b.budgetAmount,
      spent: b.spentAmount,
      remaining: b.budgetAmount - b.spentAmount,
    });
  }

  return budgets;
}
