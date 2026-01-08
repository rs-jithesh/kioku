import type { ILLMProvider, Message, OnUpdateCallback } from './base';
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';

export class LocalProvider implements ILLMProvider {
    name = 'Local (WebGPU)';
    private engine: MLCEngine | null = null;
    private modelId = 'gemma-3-4b-it-q4f16_1-MLC'; // Use latest Google Gemma 3 model
    private onProgress?: (progress: { progress: number; text: string }) => void;

    constructor(onProgress?: (progress: { progress: number; text: string }) => void) {
        this.onProgress = onProgress;
    }

    setModel(modelId: string) {
        this.modelId = modelId;
        this.engine = null; // Reset engine if model changes
    }

    async chatCompletion(messages: Message[], onUpdate?: OnUpdateCallback): Promise<string> {
        if (!this.engine) {
            await this.initEngine();
        }

        if (!this.engine) throw new Error("Local engine failed to initialize");

        const chunks = await this.engine.chat.completions.create({
            messages: messages as any,
            stream: true,
        });

        let fullText = "";
        for await (const chunk of chunks) {
            const content = chunk.choices[0]?.delta?.content || "";
            fullText += content;
            if (onUpdate) onUpdate(fullText);
        }

        return fullText;
    }

    private async initEngine() {
        try {
            this.engine = await CreateMLCEngine(this.modelId, {
                initProgressCallback: (report) => {
                    console.log('Local LLM Progress:', report.text);
                    if (this.onProgress) {
                        this.onProgress({
                            progress: report.progress,
                            text: report.text
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Failed to initialize WebLLM engine:', error);
            throw error;
        }
    }
}
