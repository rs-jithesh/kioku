import React, { useState, useEffect } from 'react';
import { MDButton } from './common/MDButton';
import { MDInput } from './common/MDInput';
import { llmService } from '../services/llm';
import './Onboarding.css';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState<'splash' | 'setup'>('splash');
    const [provider, setProvider] = useState('groq');
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (step === 'splash') {
            const timer = setTimeout(() => setStep('setup'), 2000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    const handleComplete = async () => {
        localStorage.setItem('AI_PROVIDER_TYPE', provider);
        localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);

        await llmService.loadProvider();
        onComplete();
    };

    if (step === 'splash') {
        return (
            <div className="onboarding-splash">
                <div className="splash-logo">
                    <span className="material-symbols-rounded">cloud</span>
                </div>
                <h1>Kioku</h1>
                <p>Multi-Provider Power</p>
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
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
            </select>

            <MDInput
                label={`${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                className="api-input"
            />

            <MDButton variant="filled" onClick={handleComplete} disabled={!apiKey}>
                Get Started
            </MDButton>
        </div>
    );
};
