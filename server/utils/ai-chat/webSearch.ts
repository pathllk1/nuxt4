export type SearchMode = 'auto' | 'force' | 'never';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
}

export interface WebSearchOutcome {
  searched: boolean;
  context: string;
  sources: Array<{ title: string; url: string }>;
  error?: string;
}

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_TIMEOUT_MS = 8000;

const SEARCH_TRIGGER_PATTERNS: RegExp[] = [
  /\b(latest|recent|current|today|yesterday|now|this week|this month|this year|right now|just now)\b/i,
  /\b(202[4-9]|2030)\b/,
  /\b(weather|forecast|stock price|stock market|exchange rate|cryptocurrency|bitcoin|ethereum|live score|match score|election results?)\b/i,
  /\b(search for|look up|find me|find out|google|what happened|breaking news|news about|latest news)\b/i,
  /\b(release notes?|changelog|what's new|update[sd]?|announced|launched|released|deprecated)\b/i,
  /\b(price of|cost of|how much does|where to buy|available|in stock|shipping|delivery)\b/i,
  /\b(upcoming|schedule|event|conference|when is|when does|when will)\b/i,
];

const SKIP_SEARCH_PATTERNS: RegExp[] = [
  /\b(write a function|write a class|create a component|fix this code|debug this|refactor|implement)\b/i,
  /\b(explain|how does .* work|what is the difference|compare .* and|what are the pros and cons)\b/i,
  /\b(write a poem|write a story|write a song|generate a|create a story|imagine)\b/i,
  /\b(calculate|solve|compute|convert|formula|equation|math)\b/i,
  /\b(translate|summarize this|rewrite|paraphrase)\b/i,
];

export function needsWebSearch(message: string, searchMode: SearchMode, hasTavilyKey: boolean): boolean {
  if (searchMode === 'never') return false;
  if (searchMode === 'force') return hasTavilyKey;

  if (!hasTavilyKey) return false;

  const matchesSkip = SKIP_SEARCH_PATTERNS.some(p => p.test(message));
  if (matchesSkip) return false;

  const matchesTrigger = SEARCH_TRIGGER_PATTERNS.some(p => p.test(message));
  return matchesTrigger;
}

export async function performSearch(query: string, tavilyApiKey: string): Promise<TavilySearchResponse | null> {
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyApiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        topic: 'general',
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      query: data.query || query,
      answer: data.answer || undefined,
      results: (data.results || []).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        score: r.score || 0,
      })),
    };
  } catch {
    return null;
  }
}

export function buildSearchContext(searchResponse: TavilySearchResponse): string {
  const parts: string[] = [
    '--- Web Search Results ---',
    `Search query: "${searchResponse.query}"`,
  ];

  if (searchResponse.answer) {
    parts.push('');
    parts.push(`Summary: ${searchResponse.answer}`);
  }

  if (searchResponse.results.length > 0) {
    parts.push('');
    parts.push('Sources:');
    for (const result of searchResponse.results) {
      parts.push(`- ${result.title} (${result.url})`);
      if (result.content) {
        const snippet = result.content.length > 300
          ? result.content.substring(0, 297) + '...'
          : result.content;
        parts.push(`  ${snippet}`);
      }
    }
  }

  parts.push('');
  parts.push('--- End Web Search Results ---');
  parts.push('');
  parts.push('Use the above web search results to inform your response with current, accurate information. Cite sources where relevant.');

  return parts.join('\n');
}

export async function executeWebSearch(
  message: string,
  searchMode: SearchMode,
  tavilyApiKey?: string
): Promise<WebSearchOutcome> {
  const hasTavilyKey = !!tavilyApiKey && tavilyApiKey.trim().length > 0;

  if (searchMode === 'force' && !hasTavilyKey) {
    return {
      searched: false,
      context: '',
      sources: [],
      error: 'Tavily API key is required for forced web search. Add it in Settings.',
    };
  }

  if (!needsWebSearch(message, searchMode, hasTavilyKey)) {
    return { searched: false, context: '', sources: [] };
  }

  const searchResponse = await performSearch(message, tavilyApiKey!);

  if (!searchResponse || searchResponse.results.length === 0) {
    return { searched: false, context: '', sources: [] };
  }

  const context = buildSearchContext(searchResponse);
  const sources = searchResponse.results.map(r => ({
    title: r.title,
    url: r.url,
  }));

  return {
    searched: true,
    context,
    sources,
  };
}

export async function validateTavilyKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: 'test',
        search_depth: 'basic',
        max_results: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
