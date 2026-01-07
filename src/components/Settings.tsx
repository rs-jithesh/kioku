import React, { useState } from 'react';
import { MDInput } from './common/MDInput';
import { MDButton } from './common/MDButton';
import { llmService } from '../services/llm';
import { requestLocationPermission, requestNotificationPermission, haptics } from '../services/deviceCapabilities';
import './Settings.css';

export const Settings: React.FC = () => {
    const [provider, setProvider] = useState(localStorage.getItem('AI_PROVIDER_TYPE') || 'groq');
    const [groqKey, setGroqKey] = useState(localStorage.getItem('GROQ_API_KEY') || '');
    const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('OPENAI_API_KEY') || '');
    const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('ANTHROPIC_API_KEY') || '');
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
    const [openRouterKey, setOpenRouterKey] = useState(localStorage.getItem('OPENROUTER_API_KEY') || '');
    const [fontScale, setFontScale] = useState(Number(localStorage.getItem('APP_FONT_SCALE')) || 1);
    const [status, setStatus] = useState('');
    const [locationEnabled, setLocationEnabled] = useState(localStorage.getItem('PREF_LOCATION_ENABLED') === 'true');
    const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('PREF_NOTIFICATIONS_ENABLED') === 'true');

    const handleSave = () => {
        const keyMap: Record<string, string> = {
            groq: groqKey,
            openai: openaiKey,
            anthropic: anthropicKey,
            gemini: geminiKey,
            openrouter: openRouterKey,
        };

        if (!keyMap[provider]?.trim()) {
            setStatus('Please enter an API key for the selected provider.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        localStorage.setItem('AI_PROVIDER_TYPE', provider);
        localStorage.setItem('GROQ_API_KEY', groqKey);
        localStorage.setItem('OPENAI_API_KEY', openaiKey);
        localStorage.setItem('ANTHROPIC_API_KEY', anthropicKey);
        localStorage.setItem('GEMINI_API_KEY', geminiKey);
        localStorage.setItem('OPENROUTER_API_KEY', openRouterKey);
        localStorage.setItem('APP_FONT_SCALE', String(fontScale));
        localStorage.setItem('PREF_LOCATION_ENABLED', String(locationEnabled));
        localStorage.setItem('PREF_NOTIFICATIONS_ENABLED', String(notificationsEnabled));

        llmService.loadProvider();
        haptics.success();
        setStatus('Settings saved successfully!');
        setTimeout(() => setStatus(''), 3000);
    };

    const handleToggleLocation = async () => {
        if (!locationEnabled) {
            const granted = await requestLocationPermission();
            if (granted) setLocationEnabled(true);
        } else {
            setLocationEnabled(false);
        }
    };

    const handleToggleNotifications = async () => {
        if (!notificationsEnabled) {
            const granted = await requestNotificationPermission();
            if (granted) setNotificationsEnabled(true);
        } else {
            setNotificationsEnabled(false);
        }
    };

    const handleFontScaleChange = (scale: number) => {
        setFontScale(scale);
        document.documentElement.style.setProperty('--app-font-scale', String(scale));
    };

    return (
        <div className="settings-container">
            <h2>App Settings</h2>

            <div className="settings-section">
                <h3>Display</h3>
                <div className="setting-item">
                    <label>Font Size Scale ({fontScale.toFixed(2)}x)</label>
                    <input
                        type="range"
                        min="0.8"
                        max="1.5"
                        step="0.05"
                        value={fontScale}
                        onChange={(e) => handleFontScaleChange(Number(e.target.value))}
                        className="font-scaling-slider"
                    />
                </div>
            </div>

            <div className="settings-section">
                <h3>AI Provider</h3>
                <label>Active Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="provider-select">
                    <option value="groq">Groq (Fastest)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic (Claude 3.5)</option>
                    <option value="gemini">Google Gemini (1.5 Flash)</option>
                    <option value="openrouter">OpenRouter (Any Model)</option>
                </select>
            </div>

            <div className="settings-section">
                <h3>API Key</h3>
                {provider === 'groq' && (
                    <MDInput label="Groq API Key" value={groqKey} onChange={(e) => setGroqKey(e.target.value)} type="password" />
                )}
                {provider === 'openai' && (
                    <MDInput label="OpenAI API Key" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} type="password" />
                )}
                {provider === 'anthropic' && (
                    <MDInput label="Anthropic API Key" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} type="password" />
                )}
                {provider === 'gemini' && (
                    <MDInput label="Gemini API Key" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} type="password" />
                )}
                {provider === 'openrouter' && (
                    <MDInput label="OpenRouter API Key" value={openRouterKey} onChange={(e) => setOpenRouterKey(e.target.value)} type="password" />
                )}
            </div>

            <div className="settings-section">
                <h3>Device Permissions</h3>
                <div className="setting-item flex-row">
                    <div className="setting-label-group">
                        <label>Geolocation</label>
                        <small>Provide location context for memories and notes</small>
                    </div>
                    <MDButton variant={locationEnabled ? "filled" : "outlined"} onClick={handleToggleLocation}>
                        {locationEnabled ? "Enabled" : "Enable"}
                    </MDButton>
                </div>

                <div className="setting-item flex-row">
                    <div className="setting-label-group">
                        <label>Notifications</label>
                        <small>Get alerts for reminders and updates</small>
                    </div>
                    <MDButton variant={notificationsEnabled ? "filled" : "outlined"} onClick={handleToggleNotifications}>
                        {notificationsEnabled ? "Enabled" : "Enable"}
                    </MDButton>
                </div>
            </div>

            <div className="settings-actions">
                {status && <span className="status-msg">{status}</span>}
                <MDButton variant="filled" onClick={handleSave}>Save Changes</MDButton>
            </div>
        </div>
    );
};
