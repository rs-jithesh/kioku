export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type OnUpdateCallback = (text: string) => void;

export interface ILLMProvider {
    name: string;
    chatCompletion(messages: Message[], onUpdate?: OnUpdateCallback): Promise<string>;
}

export abstract class BaseCloudProvider implements ILLMProvider {
    abstract name: string;
    protected abstract apiUrl: string;
    protected abstract model: string;
    protected apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async chatCompletion(messages: Message[], onUpdate?: OnUpdateCallback): Promise<string> {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: this.getHeaders(),
            body: this.getBody(messages)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`AI Provider Error: ${error.error?.message || response.statusText}`);
        }

        return this.handleStream(response, onUpdate);
    }

    protected abstract getHeaders(): Record<string, string>;
    protected abstract getBody(messages: Message[]): string;

    protected async handleStream(response: Response, onUpdate?: OnUpdateCallback): Promise<string> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read response stream");

        let fullText = "";
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.includes('[DONE]')) break;
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const content = this.extractContent(data);
                        fullText += content;
                        if (onUpdate) onUpdate(fullText);
                    } catch (e) {
                        // Ignore incomplete JSON chunks
                    }
                }
            }
        }
        return fullText;
    }

    protected abstract extractContent(data: any): string;
}
