export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type OnUpdateCallback = (text: string) => void;

export interface ILLMProvider {
    name: string;
    chatCompletion(messages: Message[], onUpdate?: OnUpdateCallback): Promise<string>;
}

export class BaseCloudProvider implements ILLMProvider {
    name: string = 'Base';
    protected apiUrl: string = '';
    protected model: string = '';
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
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                // Extract message from common error formats
                errorMessage = errorData.error?.message ||
                    errorData.message ||
                    errorData.error ||
                    (errorData.choices?.[0]?.message) ||
                    JSON.stringify(errorData);
            } catch (e) {
                // If JSON parsing fails, try to get raw text
                try {
                    const text = await response.text();
                    if (text) errorMessage = text.slice(0, 200); // Limit length
                } catch (e2) { }
            }
            throw new Error(errorMessage);
        }

        return this.handleStream(response, onUpdate);
    }

    protected getHeaders(): Record<string, string> { return {}; }
    protected getBody(_messages: Message[]): string { return ''; }

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

    protected extractContent(_data: any): string { return ''; }
}
