import React, { useState, useEffect } from 'react';
import { MDInput } from './common/MDInput';
import { MDButton } from './common/MDButton';
import { llmService } from '../services/llm';
import { requestLocationPermission, requestNotificationPermission, haptics } from '../services/deviceCapabilities';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { MDDialog } from './common/MDDialog';
import './Settings.css';

const API_KEY_URLS: Record<string, string> = {
    groq: 'https://console.groq.com/keys',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    gemini: 'https://aistudio.google.com/app/apikey'
};


export const Settings: React.FC = () => {
    const { isInstallable, isInstalled, promptInstall, platform } = usePWAInstall();
    const [provider, setProvider] = useState(localStorage.getItem('AI_PROVIDER_TYPE') || 'groq');
    const [groqKey, setGroqKey] = useState(localStorage.getItem('GROQ_API_KEY') || '');
    const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('OPENAI_API_KEY') || '');
    const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('ANTHROPIC_API_KEY') || '');
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
    const [fontScale, setFontScale] = useState(Number(localStorage.getItem('APP_FONT_SCALE')) || 1);
    const [status, setStatus] = useState('');
    const [locationEnabled, setLocationEnabled] = useState(localStorage.getItem('PREF_LOCATION_ENABLED') === 'true');
    const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('PREF_NOTIFICATIONS_ENABLED') === 'true');
    const [webSearchEnabled, setWebSearchEnabled] = useState(localStorage.getItem('PREF_WEB_SEARCH_ENABLED') === 'true');
    const [voiceLang, setVoiceLang] = useState(localStorage.getItem('PREF_VOICE_LANG') || 'en-US');
    const [serperKey, setSerperKey] = useState(localStorage.getItem('SERPER_API_KEY') || '');
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [webGPUSupport, setWebGPUSupport] = useState<{ supported: boolean; message?: string }>({ supported: true });

    // Local Model State
    const [localModelId, setLocalModelId] = useState(localStorage.getItem('LOCAL_MODEL_ID') || 'gemma-3-4b-it-q4f16_1-MLC');

    useEffect(() => {
        llmService.checkWebGPUSupport().then(setWebGPUSupport);
    }, []);



    const handleSave = () => {
        const keyMap: Record<string, string> = {
            groq: groqKey,
            openai: openaiKey,
            anthropic: anthropicKey,
            gemini: geminiKey,
        };

        if (provider !== 'local' && !keyMap[provider]?.trim()) {
            setStatus('Please enter an API key for the selected provider.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        if (provider === 'local' && !webGPUSupport.supported) {
            setStatus('Local LLM is not supported on this device/browser.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        localStorage.setItem('AI_PROVIDER_TYPE', provider);
        localStorage.setItem('GROQ_API_KEY', groqKey);
        localStorage.setItem('OPENAI_API_KEY', openaiKey);
        localStorage.setItem('ANTHROPIC_API_KEY', anthropicKey);
        localStorage.setItem('GEMINI_API_KEY', geminiKey);
        localStorage.setItem('APP_FONT_SCALE', String(fontScale));
        localStorage.setItem('PREF_LOCATION_ENABLED', String(locationEnabled));
        localStorage.setItem('PREF_NOTIFICATIONS_ENABLED', String(notificationsEnabled));
        localStorage.setItem('PREF_WEB_SEARCH_ENABLED', String(webSearchEnabled));
        localStorage.setItem('SERPER_API_KEY', serperKey);
        localStorage.setItem('PREF_VOICE_LANG', voiceLang);

        if (provider === 'local') {
            localStorage.setItem('LOCAL_MODEL_ID', localModelId);
            // Trigger model update if service is instantiated
        }

        llmService.loadProvider();
        haptics.success();
        setShowSuccessDialog(true);
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
                    <option value="gemini">Google Gemini (2.5 Flash)</option>
                    <option value="local">Local LLM (Private & Offline)</option>
                </select>
                {provider === 'local' && !webGPUSupport.supported && (
                    <div className="setting-error" style={{ marginTop: '12px', color: 'var(--md-sys-color-error)', fontSize: '13px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>error</span>
                        {webGPUSupport.message}
                    </div>
                )}
                {provider === 'local' && webGPUSupport.supported && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        <div className="setting-tip" style={{ padding: '12px', backgroundColor: 'var(--md-sys-color-tertiary-container)', borderRadius: '12px', fontSize: '13px', color: 'var(--md-sys-color-on-tertiary-container)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>bolt</span>
                            <strong>On-Device AI:</strong> Local LLM runs entirely on your GPU. The first run will download model data to your browser cache.
                        </div>

                        <div className="model-selector-box" style={{
                            border: '1px solid var(--md-sys-color-outline)',
                            borderRadius: '12px',
                            padding: '16px',
                            backgroundColor: 'var(--md-sys-color-surface-container-low)'
                        }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--md-sys-color-outline)', marginBottom: '8px' }}>HuggingFace Model ID</label>
                            <MDInput
                                label="Model ID or URL"
                                value={localModelId}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (val.startsWith('https://huggingface.co/')) {
                                        val = val.replace('https://huggingface.co/', '');
                                    }
                                    setLocalModelId(val);
                                }}
                                placeholder="e.g. mlc-ai/gemma-3-4b-it-q4f16_1-MLC"
                            />

                            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center' }}>
                                <a
                                    href="https://huggingface.co/models?search=mlc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: 'var(--md-sys-color-primary)',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>open_in_new</span>
                                    Browse Compatible Models (HuggingFace)
                                </a>
                            </div>
                        </div>
                    </div>
                )}
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
                {provider !== 'local' && (
                    <div className="api-key-portal-link" style={{ marginTop: '12px' }}>
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
                )}
                {provider === 'local' && (
                    <div className="setting-tip" style={{ marginTop: '12px', fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>lock</span>
                        No API Key required for Local LLM. Your data stays on your device.
                    </div>
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

            <div className="settings-section">
                <h3>AI Features</h3>
                <div className="setting-item flex-row">
                    <div className="setting-label-group">
                        <label>Web Search</label>
                        <small>Enable web search to get real-time information from the internet using SearXNG</small>
                    </div>
                    <MDButton variant={webSearchEnabled ? "filled" : "outlined"} onClick={() => setWebSearchEnabled(!webSearchEnabled)}>
                        {webSearchEnabled ? "Enabled" : "Enable"}
                    </MDButton>
                </div>
                {webSearchEnabled && (
                    <div className="setting-item" style={{ marginTop: '16px' }}>
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
                            Get Free Serper Key
                        </a>
                        <small style={{ display: 'block', color: 'var(--md-sys-color-on-surface-variant)', fontSize: '12px', lineHeight: '1.4', marginTop: '12px' }}>
                            Web search uses Serper.dev to provide high-quality Google Search results. Results are included in AI responses for real-time information.
                        </small>
                    </div>
                )}
            </div>

            <div className="settings-section">
                <h3>Voice & Speech</h3>
                <div className="setting-item">
                    <label>Voice Input Language</label>
                    <select
                        value={voiceLang}
                        onChange={(e) => setVoiceLang(e.target.value)}
                        className="provider-select"
                    >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="en-IN">English (India)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                        <option value="ja-JP">Japanese</option>
                        <option value="hi-IN">Hindi</option>
                        <option value="zh-CN">Chinese</option>
                    </select>
                </div>
            </div>

            {isInstallable && !isInstalled ? (
                <section className="settings-section install-banner">
                    <div className="install-content">
                        <span className="material-symbols-rounded">install_mobile</span>
                        <div className="install-text">
                            <h3>Install Kioku</h3>
                            <p>Add Kioku to your home screen for a full-screen experience and offline access.</p>
                        </div>
                        <MDButton variant="filled" onClick={promptInstall}>Install</MDButton>
                    </div>
                </section>
            ) : !isInstalled && (
                <section className="settings-section tip-box">
                    <div className="tip-content">
                        <span className="material-symbols-rounded">info</span>
                        <div className="tip-text">
                            <p><strong>Note on Installation:</strong> If you don't see an install button, ensure you are accessing via <code>localhost</code> or an <code>https://</code> URL. Browsers require a secure connection to enable PWA features.</p>
                            {platform === 'ios' && <p>On iOS, use the Share menu and select "Add to Home Screen".</p>}
                        </div>
                    </div>
                </section>
            )}

            <div className="settings-actions">
                {status && <span className="status-msg">{status}</span>}
                <MDButton variant="filled" onClick={handleSave}>Save Changes</MDButton>
            </div>

            <MDDialog
                isOpen={showSuccessDialog}
                onClose={() => setShowSuccessDialog(false)}
                title="Settings Saved"
                message="Your preferences and API keys have been updated successfully."
                icon="check_circle"
            />
        </div>
    );
};
