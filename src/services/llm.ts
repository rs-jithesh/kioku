import type { ILLMProvider, Message, OnUpdateCallback } from './providers/base';
export type { Message, OnUpdateCallback };
import { GroqProvider, OpenAIProvider, AnthropicProvider, GeminiProvider } from './providers/cloudProviders';
import { LocalProvider } from './providers/localProvider';

export class LLMService {
    private activeProvider: ILLMProvider | null = null;
    private onProgress?: (progress: { progress: number; text: string }) => void;

    constructor() {
        this.loadProvider();
    }

    setProgressListener(callback: (progress: { progress: number; text: string }) => void) {
        this.onProgress = callback;
    }

    loadProvider() {
        const type = localStorage.getItem('AI_PROVIDER_TYPE') || 'groq';
        const apiKey = localStorage.getItem(`${type.toUpperCase()}_API_KEY`);

        // Local provider doesn't need an API key
        if (type !== 'local' && !apiKey) {
            this.activeProvider = null;
            return;
        }

        switch (type) {
            case 'groq':
                this.activeProvider = new GroqProvider(apiKey!);
                break;
            case 'openai':
                this.activeProvider = new OpenAIProvider(apiKey!);
                break;
            case 'anthropic':
                this.activeProvider = new AnthropicProvider(apiKey!);
                break;
            case 'gemini':
                this.activeProvider = new GeminiProvider(apiKey!);
                break;
            case 'local':
                this.activeProvider = new LocalProvider((p) => {
                    if (this.onProgress) this.onProgress(p);
                });
                break;
            default:
                this.activeProvider = null;
        }
    }

    isReady() {
        return this.activeProvider !== null;
    }

    async chatCompletion(messages: Message[], onUpdate?: OnUpdateCallback) {
        if (!this.activeProvider) {
            throw new Error("No AI provider configured. Please check your settings.");
        }
        return this.activeProvider.chatCompletion(messages, onUpdate);
    }

    async extractUserFacts(chatHistory: Message[]): Promise<Record<string, string>> {
        if (!this.activeProvider) await this.loadProvider();
        if (!this.activeProvider) return {};

        const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `Analyze this conversation segment and extract NEW facts about the user.
Focus on: preferences, personal info, habits, work context, relationships, goals.
Be specific with keys (e.g., "preferred_ide" not just "preference").
Return ONLY a JSON object. If no new facts, return {}.

Conversation:
${historyText}`;

        try {
            const response = await this.activeProvider.chatCompletion([
                { role: 'system', content: 'Extract user facts as JSON. Output only valid JSON, no explanation.' },
                { role: 'user', content: prompt }
            ]);

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Fact extraction failed', e);
            return {};
        }
    }

    extractExplicitMemory(text: string): Record<string, string> | null {
        const patterns = [
            /(?:remember|don'?t forget|keep in mind|note)\s+(?:that\s+)?(?:i\s+|my\s+)?(.+)/i,
            /(?:i\s+(?:prefer|like|love|hate|use|work with|am|have))\s+(.+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const factText = match[1].trim().replace(/[.!?]$/, '');
                const keyWords = factText.split(/\s+/).slice(0, 3).join('_').toLowerCase()
                    .replace(/[^a-z0-9_]/g, '');
                return { [keyWords || 'user_preference']: factText };
            }
        }
        return null;
    }

    async summarizeConversation(chatHistory: Message[]): Promise<string> {
        if (!this.activeProvider) await this.loadProvider();
        if (!this.activeProvider) return "History.";

        const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');

        try {
            const response = await this.activeProvider.chatCompletion([
                { role: 'system', content: 'You are a helpful summarizer.' },
                { role: 'user', content: `Summarize the key takeaways from this conversation into a single sentence:\n${historyText}` }
            ]);
            return response;
        } catch (e) {
            console.error('Summarization failed', e);
            return "Note on previous conversation.";
        }
    }

    async checkWebGPUSupport(): Promise<{ supported: boolean; message?: string }> {
        if (!('gpu' in navigator)) {
            return {
                supported: false,
                message: "WebGPU is not supported by your browser. Try Chrome, Edge, or a compatible browser."
            };
        }
        try {
            const adapter = await (navigator as any).gpu.requestAdapter();
            if (!adapter) {
                return {
                    supported: false,
                    message: "WebGPU is supported but failed to initialize an adapter. Check your hardware/drivers."
                };
            }
            return { supported: true };
        } catch (e) {
            return {
                supported: false,
                message: "Error checking WebGPU support: " + (e as Error).message
            };
        }
    }

    async initialize() {
        return Promise.resolve();
    }
}

export const llmService = new LLMService();
