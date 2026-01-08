/**
 * Web Search Service using Serper.dev
 */

export interface SearchResult {
    title: string;
    url: string;
    content: string;
}

export class WebSearchService {
    private apiUrl = 'https://google.serper.dev/search';

    constructor() { }

    /**
     * Perform a web search using Serper.dev (Google Search API)
     * @param query - The search query
     * @param maxResults - Maximum number of results to return (default: 5)
     * @returns Array of search results
     */
    async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        const apiKey = localStorage.getItem('SERPER_API_KEY');
        if (!apiKey) {
            console.error('Serper API Key not found');
            return [];
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: query,
                    num: maxResults,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Search failed: ${response.status} ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            // Serper returns results in 'organic' property
            if (!data.organic || !Array.isArray(data.organic)) {
                return [];
            }

            // Map Serper results to our format
            return data.organic.map((result: any) => ({
                title: result.title || 'No title',
                url: result.link || '',
                content: result.snippet || '',
            })).filter((result: SearchResult) => result.url && result.title);

        } catch (error) {
            console.error('Web search error (Serper):', error);
            return [];
        }
    }

    /**
     * Format search results for inclusion in LLM context
     */
    formatResultsForContext(results: SearchResult[]): string {
        if (results.length === 0) {
            return '';
        }

        const formatted = results.map((result, index) => {
            return `${index + 1}. **${result.title}**\n   URL: ${result.url}\n   ${result.content}`;
        }).join('\n\n');

        return `\n\nWeb Search Results:\n${formatted}`;
    }

    /**
     * Check if web search is enabled
     */
    static isEnabled(): boolean {
        const enabled = localStorage.getItem('PREF_WEB_SEARCH_ENABLED') === 'true';
        const hasKey = !!localStorage.getItem('SERPER_API_KEY');
        return enabled && hasKey;
    }
}

export const webSearchService = new WebSearchService();
