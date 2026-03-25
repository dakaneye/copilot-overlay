// src/api/claude.js
// Claude Haiku categorization client

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Categorize a domain using Claude Haiku
 * @param {string} apiKey - Claude API key
 * @param {string} domain - Domain to categorize
 * @param {string[]} categories - Available category names
 * @returns {Promise<string>} - Suggested category
 */
export async function categorizeWithHaiku(apiKey, domain, categories) {
  const systemPrompt = `You categorize websites into budget categories. Respond with only the category name, nothing else.

Categories: ${categories.join(', ')}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `What budget category is "${domain}"?`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const suggestion = data.content[0].text.trim();

  // Validate suggestion is a known category
  if (categories.includes(suggestion)) {
    return suggestion;
  }

  // Try case-insensitive match
  const match = categories.find(
    c => c.toLowerCase() === suggestion.toLowerCase()
  );
  if (match) {
    return match;
  }

  // Fall back to "Other" or first category
  return categories.includes('Other') ? 'Other' : categories[0];
}
