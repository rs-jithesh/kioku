import type { ILLMProvider, Message, OnUpdateCallback } from './base';
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';

export class LocalProvider implements ILLMProvider {
    name = 'Local (WebGPU)';
    private engine: MLCEngine | null = null;
    private modelId = localStorage.getItem('LOCAL_MODEL_ID') || 'gemma-3-4b-it-q4f16_1-MLC';
    private onProgress?: (progress: { progress: number; text: string }) => void;

    constructor(onProgress?: (progress: { progress: number; text: string }) => void) {
        this.onProgress = onProgress;
    }

    setModel(modelId: string) {
        this.modelId = modelId;
        localStorage.setItem('LOCAL_MODEL_ID', modelId);
        this.engine = null; // Reset engine to force reload
    }

    getModel() {
        return this.modelId;
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
            const { prebuiltAppConfig } = await import('@mlc-ai/web-llm');
            let appConfig = prebuiltAppConfig;

            // Check if model exists in default config
            const modelExists = prebuiltAppConfig.model_list.some(m => m.model_id === this.modelId);

            if (!modelExists) {
                console.log(`Model ${this.modelId} not found in prebuilt config. Attempting to auto-configure...`);

                // Assume the input is a HF repo ID (e.g. "mlc-ai/gemma-3-4b-it-q4f16_1-MLC")
                const hfUrl = `https://huggingface.co/${this.modelId}/resolve/main/mlc-chat-config.json`;

                try {
                    const response = await fetch(hfUrl);
                    if (!response.ok) throw new Error(`Failed to fetch config from ${hfUrl}`);

                    const modelConfig = await response.json();

                    // We need to map the model_lib from the config to a generic one if possible, 
                    // or hope that web-llm can handle the raw string if it matches internal registry.
                    // For now, we use the one from JSON or fallback to a guess based on name.
                    let modelLib = modelConfig.model_lib;

                    // Construct the new model entry
                    const newModelEntry = {
                        model_id: this.modelId,
                        model: `https://huggingface.co/${this.modelId}`, // WebLLM expects the repo URL
                        model_lib: modelLib,
                        vram_required_MB: 4096, // Conservative default
                        low_resource_required: true,
                    };

                    console.log('Auto-configured model entry:', newModelEntry);

                    // Create a new config merging defaults with our new model
                    appConfig = {
                        ...prebuiltAppConfig,
                        model_list: [...prebuiltAppConfig.model_list, newModelEntry],
                        useIndexedDBCache: true
                    };

                } catch (configError) {
                    console.error("Failed to auto-configure custom model:", configError);
                    // Fallthrough to try loading anyway, maybe it IS supported but just not in the list we checked? 
                    // Or let CreateMLCEngine fail naturally.
                }
            }

            this.engine = await CreateMLCEngine(this.modelId, {
                appConfig: appConfig,
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
