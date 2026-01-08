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

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState<'splash' | 'setup'>('splash');
    const [provider, setProvider] = useState('groq');
    const [apiKey, setApiKey] = useState('');
    const [serperKey, setSerperKey] = useState('');
    const [webSearchEnabled] = useState(false);

    useEffect(() => {
        if (step === 'splash') {
            const timer = setTimeout(() => setStep('setup'), 2000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    const handleComplete = async () => {
        localStorage.setItem('AI_PROVIDER_TYPE', provider);
        localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);
        if (serperKey) {
            localStorage.setItem('SERPER_API_KEY', serperKey);
            localStorage.setItem('PREF_WEB_SEARCH_ENABLED', 'true');
        } else {
            localStorage.setItem('PREF_WEB_SEARCH_ENABLED', String(webSearchEnabled));
        }

        await llmService.loadProvider();
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
                <option value="groq">Groq (Fastest)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude 3.5)</option>
                <option value="gemini">Google Gemini (2.5 Flash)</option>
            </select>

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

            <MDButton variant="filled" onClick={handleComplete} disabled={!apiKey}>
                Get Started
            </MDButton>
        </div>
    );
};
