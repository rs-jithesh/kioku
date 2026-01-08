import React, { useState, useEffect } from 'react';
import { MDButton } from './common/MDButton';
import { MDInput } from './common/MDInput';
import { llmService } from '../services/llm';
import './Onboarding.css';

const API_KEY_URLS: Record<string, string> = {
    groq: 'https://console.groq.com/keys',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    gemini: 'https://aistudio.google.com/app/apikey',
    serper: 'https://serper.dev'
};

interface OnboardingProps {
    onComplete: () => void;
}

interface HFModel {
    id: string;
    likes: number;
    downloads: number;
    tags: string[];
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState<'splash' | 'setup'>('splash');
    const [provider, setProvider] = useState('local');
    const [apiKey, setApiKey] = useState('');
    const [serperKey, setSerperKey] = useState('');
    const [webSearchEnabled] = useState(false);
    const [webGPUSupport, setWebGPUSupport] = useState<{ supported: boolean; message?: string }>({ supported: true });

    // Local Model Search State
    const [localModelId, setLocalModelId] = useState(localStorage.getItem('LOCAL_MODEL_ID') || 'gemma-3-4b-it-q4f16_1-MLC');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<HFModel[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showModelSearch, setShowModelSearch] = useState(false);

    useEffect(() => {
        if (step === 'splash') {
            const timer = setTimeout(() => setStep('setup'), 2000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    useEffect(() => {
        llmService.checkWebGPUSupport().then(setWebGPUSupport);
    }, []);

    const searchHFModels = async (query: string) => {
        setIsSearching(true);
        try {
            // Search specifically for models likely to be compatible with WebLLM/MLC
            // We search for "MLC" keyword or models with mlc-ai tag
            const q = query.trim() || "MLC";
            const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=20&sort=likes&direction=-1`);
            const data = await response.json();

            // Basic filtering for potential compatibility (not perfect, but reasonable)
            const models = data.filter((m: any) =>
                m.id.includes('MLC') ||
                m.tags.includes('mlc-ai') ||
                m.id.includes('q4f16_1') // Common quantization for WebLLM
            ).map((m: any) => ({
                id: m.id,
                likes: m.likes,
                downloads: m.downloads,
                tags: m.tags
            }));

            setSearchResults(models);
        } catch (e) {
            console.error("HF Search failed", e);
        } finally {
            setIsSearching(false);
        }
    };

    // Auto-search default on open
    useEffect(() => {
        if (showModelSearch) {
            searchHFModels(searchQuery);
        }
    }, [showModelSearch]);

    const handleComplete = async () => {
        localStorage.setItem('AI_PROVIDER_TYPE', provider);

        if (provider === 'local') {
            localStorage.setItem('LOCAL_MODEL_ID', localModelId);
        } else {
            localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);
        }

        if (serperKey) {
            localStorage.setItem('SERPER_API_KEY', serperKey);
            localStorage.setItem('PREF_WEB_SEARCH_ENABLED', 'true');
        } else {
            localStorage.setItem('PREF_WEB_SEARCH_ENABLED', String(webSearchEnabled));
        }

        await llmService.loadProvider();

        // If local, trigger a re-set of the model in the provider
        if (provider === 'local') {
            // Access the service instance and cast the provider if possible or reload
            // llmService.loadProvider() calls new LocalProvider() which reads from localStorage
        }

        onComplete();
    };

    if (step === 'splash') {
        return (
            <div className="onboarding-splash">
                <div className="splash-logo-container">
                    <img src="/logo.jpg" alt="Kioku Logo" className="splash-logo-img" />
                </div>
                <h1>Kioku</h1>
                <p>Your AI assistant</p>
                <div className="splash-spinner"></div>
            </div>
        );
    }

    return (
        <div className="onboarding-step">
            <span className="material-symbols-rounded step-icon">rocket_launch</span>
            <h2>Welcome</h2>
            <p>Choose your preferred AI provider to get started. You can change this later in settings.</p>

            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="provider-select-onboarding">
                <option value="local">Local LLM (Private & Offline)</option>
                <option value="groq">Groq (Fastest)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude 3.5)</option>
                <option value="gemini">Google Gemini (2.5 Flash)</option>
            </select>

            {provider === 'local' ? (
                <div className="local-llm-setup" style={{ width: '100%', marginBottom: '24px' }}>
                    {!webGPUSupport.supported ? (
                        <div className="setting-error" style={{ color: 'var(--md-sys-color-error)', fontSize: '13px', padding: '12px', backgroundColor: 'var(--md-sys-color-error-container)', borderRadius: '12px' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>error</span>
                            {webGPUSupport.message}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="setting-tip" style={{ padding: '12px', backgroundColor: 'var(--md-sys-color-tertiary-container)', borderRadius: '12px', fontSize: '13px', color: 'var(--md-sys-color-on-tertiary-container)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>bolt</span>
                                <strong>On-Device AI:</strong> Privacy-first. No API Key required.
                            </div>

                            <div className="model-selector-box" style={{
                                border: '1px solid var(--md-sys-color-outline)',
                                borderRadius: '12px',
                                padding: '16px',
                                backgroundColor: 'var(--md-sys-color-surface-container-low)'
                            }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--md-sys-color-outline)', marginBottom: '8px' }}>Selected Model</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={localModelId}
                                        readOnly
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--md-sys-color-outline-variant)',
                                            backgroundColor: 'var(--md-sys-color-surface)',
                                            color: 'var(--md-sys-color-on-surface)'
                                        }}
                                    />
                                    <MDButton variant="outlined" onClick={() => setShowModelSearch(!showModelSearch)}>
                                        Change
                                    </MDButton>
                                </div>

                                {showModelSearch && (
                                    <div className="hf-search-container" style={{ marginTop: '16px', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '16px' }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                            <MDInput
                                                label="Search HF Models (e.g. 'MLC')"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && searchHFModels(searchQuery)}
                                            />
                                            <MDButton variant="filled" onClick={() => searchHFModels(searchQuery)}>
                                                <span className="material-symbols-rounded">search</span>
                                            </MDButton>
                                        </div>

                                        <div className="model-results" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {isSearching ? (
                                                <div style={{ padding: '20px', textAlign: 'center' }}>Searching...</div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map((m) => (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => {
                                                            setLocalModelId(m.id);
                                                            setShowModelSearch(false);
                                                        }}
                                                        style={{
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            backgroundColor: 'var(--md-sys-color-surface)',
                                                            cursor: 'pointer',
                                                            border: localModelId === m.id ? '2px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)'
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{m.id}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
                                                            ❤️ {m.likes} • ⬇️ {m.downloads}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--md-sys-color-outline)' }}>
                                                    No compatible models found. Try searching for "MLC" or "q4f16".
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <MDInput
                        label={`${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        type="password"
                        className="api-input"
                    />

                    <div className="api-key-link" style={{ alignSelf: 'flex-start', marginBottom: '24px', marginTop: '-12px' }}>
                        <a
                            href={API_KEY_URLS[provider]}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'var(--md-sys-color-primary)',
                                textDecoration: 'none',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>open_in_new</span>
                            Get {provider.charAt(0).toUpperCase() + provider.slice(1)} API Key
                        </a>
                    </div>
                </>
            )}

            <div className="web-search-setup" style={{ width: '100%', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>search</span>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Web Search (Optional)</h3>
                </div>
                <MDInput
                    label="Serper.dev API Key"
                    value={serperKey}
                    onChange={(e) => setSerperKey(e.target.value)}
                    type="password"
                />
                <a
                    href="https://serper.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: 'var(--md-sys-color-primary)',
                        textDecoration: 'none',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '8px'
                    }}
                >
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>open_in_new</span>
                    Get Free Serper Key (2500 searches)
                </a>
            </div>

            <MDButton variant="filled" onClick={handleComplete} disabled={provider !== 'local' && !apiKey}>
                Get Started
            </MDButton>
        </div>
    );
};
