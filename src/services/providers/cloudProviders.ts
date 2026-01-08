import { BaseCloudProvider } from './base';
import type { Message, OnUpdateCallback } from './base';

export class GroqProvider extends BaseCloudProvider {
    name = 'Groq';
    protected apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    protected model = 'llama-3.3-70b-versatile';

    protected getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    protected getBody(messages: Message[]) {
        return JSON.stringify({
            model: this.model,
            messages,
            stream: true
        });
    }

    protected extractContent(data: any) {
        return data.choices[0]?.delta?.content || "";
    }
}

export class OpenAIProvider extends BaseCloudProvider {
    name = 'OpenAI';
    protected apiUrl = 'https://api.openai.com/v1/chat/completions';
    protected model = 'gpt-4o-mini';

    protected getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    protected getBody(messages: Message[]) {
        return JSON.stringify({
            model: this.model,
            messages,
            stream: true
        });
    }

    protected extractContent(data: any) {
        return data.choices[0]?.delta?.content || "";
    }
}

export class AnthropicProvider extends BaseCloudProvider {
    name = 'Anthropic';
    protected apiUrl = 'https://api.anthropic.com/v1/messages';
    protected model = 'claude-3-5-sonnet-20241022';

    protected getHeaders() {
        return {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        };
    }

    protected getBody(messages: Message[]) {
        return JSON.stringify({
            model: this.model,
            messages,
            max_tokens: 1024,
            stream: true
        });
    }

    protected async handleStream(response: Response, onUpdate?: (text: string) => void): Promise<string> {
        // Anthropic uses different stream format (event-stream)
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read response stream");
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'content_block_delta') {
                            fullText += data.delta.text;
                            if (onUpdate) onUpdate(fullText);
                        }
                    } catch (e) { }
                }
            }
        }
        return fullText;
    }

    protected extractContent(_data: any) { return ""; } // Not used since handleStream is overridden
}

export class GeminiProvider extends BaseCloudProvider {
    name = 'Gemini';
    protected apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';
    protected model = 'gemini-2.5-flash';

    protected getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    protected getBody(messages: Message[]) {
        // Gemini format
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        return JSON.stringify({ contents });
    }

    async chatCompletion(messages: Message[], onUpdate?: (text: string) => void): Promise<string> {
        const url = `${this.apiUrl}?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: this.getBody(messages)
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                errorMsg = data.error?.message || data.message || JSON.stringify(data.error) || errorMsg;
            } catch (e) { }
            throw new Error(`Gemini Error: ${errorMsg}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read stream");
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('"text": "')) {
                    try {
                        const text = line.trim().match(/"text": "(.*)"/)?.[1];
                        if (text) {
                            // Basic unescape
                            const clean = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            fullText += clean;
                            if (onUpdate) onUpdate(fullText);
                        }
                    } catch (e) { }
                }
            }
        }
        return fullText;
    }

    protected extractContent(_data: any) { return ""; }
}

