import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { llmService, type Message } from '../services/llm';
import { vectorStore } from '../services/vectorStore';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MDInput } from './common/MDInput';
import { MDButton } from './common/MDButton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { getDeviceInfo, getLocation, haptics, canNotify } from '../services/deviceCapabilities';
import './ChatInterface.css';

interface ChatInterfaceProps {
    conversationId: number;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversationId }) => {
    const persistedMessages = useLiveQuery(
        () => db.chat_messages.where('conversationId').equals(conversationId).sortBy('timestamp'),
        [conversationId]
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isInitialLoad = useRef(true);
    const prevConvId = useRef(conversationId);

    const {
        isListening,
        transcript,
        interimTranscript,
        isSupported: isVoiceSupported,
        error: voiceError,
        startListening,
        stopListening,
        resetTranscript
    } = useVoiceInput();

    // Sync voice transcript to input
    useEffect(() => {
        if (transcript) {
            setInput(prev => {
                const base = prev.trim();
                return base ? `${base} ${transcript}` : transcript;
            });
            resetTranscript();
        }
    }, [transcript]); // Removed resetTranscript to avoid potential loops/unstable calls

    // Auto-clear voice errors
    useEffect(() => {
        if (voiceError) {
            const timer = setTimeout(() => {
                // We can't clear the error inside the hook easily if it's internal state
                // but we can at least detect it here.
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [voiceError]);

    // Sync persisted messages to local state with stability check
    useEffect(() => {
        if (!persistedMessages) return;

        const mapped = persistedMessages.map(m => ({ role: m.role, content: m.content }));

        // Only update if the length or content has actually changed
        // This prevents loops from unstable references or '|| []' fallbacks
        setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(mapped)) return prev;
            return mapped;
        });
    }, [persistedMessages, conversationId]);

    // Handle Scrolling logic - Solve Jitter
    useEffect(() => {
        const scrollToBottom = (behavior: ScrollBehavior) => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior });
            }
        };

        if (prevConvId.current !== conversationId) {
            isInitialLoad.current = true;
            prevConvId.current = conversationId;
        }

        if (messages.length > 0) {
            if (isInitialLoad.current) {
                // Instant jump on first load of a conversation
                scrollToBottom('auto');
                isInitialLoad.current = false;
            } else {
                // Smooth scroll for new messages while chatting
                scrollToBottom('smooth');
            }
        }
    }, [messages, conversationId]);

    // Store an explicit memory immediately
    const storeExplicitMemory = async (text: string) => {
        const explicitFacts = llmService.extractExplicitMemory(text);
        if (explicitFacts) {
            for (const [key, value] of Object.entries(explicitFacts)) {
                await db.user_profile.put({
                    key,
                    value: String(value),
                    updatedAt: Date.now()
                });
            }
            console.log('Stored explicit memory:', explicitFacts);
        }
    };

    // Rolling synthesis: process messages since last synthesis
    const processRollingSynthesis = async (allMessages: Message[], msgCount: number) => {
        try {
            const conv = await db.conversations.get(conversationId);
            const lastSynthesized = conv?.lastSynthesizedMsgCount || 0;

            // Only synthesize if we have 6+ new messages since last synthesis
            if (msgCount - lastSynthesized >= 6) {
                // Get messages since last synthesis
                const messagesToProcess = allMessages.slice(lastSynthesized);

                if (messagesToProcess.length > 0) {
                    const facts = await llmService.extractUserFacts(messagesToProcess);
                    for (const [key, value] of Object.entries(facts)) {
                        await db.user_profile.put({
                            key,
                            value: String(value),
                            updatedAt: Date.now()
                        });
                    }

                    // Update synthesis checkpoint
                    await db.conversations.update(conversationId, {
                        lastSynthesizedMsgCount: msgCount
                    });
                    console.log('Rolling synthesis completed:', facts);
                }
            }
        } catch (e) {
            console.warn('Rolling synthesis skipped', e);
        }
    };

    const handleSend = async (overrideInput?: string) => {
        const textToSend = overrideInput || input;
        if (!textToSend.trim() || isLoading) return;

        const userInput = textToSend;
        const userMsg: Message = { role: 'user', content: userInput };

        // Check for explicit memory commands immediately
        await storeExplicitMemory(userInput);

        await db.chat_messages.add({
            conversationId,
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        });

        // Update conversation title if it's the first real user message
        const isFirstMessage = messages.filter(m => m.role === 'user').length === 0;
        if (isFirstMessage) {
            const title = userInput.slice(0, 30) + (userInput.length > 30 ? '...' : '');
            await db.conversations.update(conversationId, { title, updatedAt: Date.now() });
        } else {
            await db.conversations.update(conversationId, { updatedAt: Date.now() });
        }

        // Don't manually add to messages - useLiveQuery handles sync from DB
        setInput('');
        setIsLoading(true);
        inputRef.current?.blur();

        try {
            const relevantNotes = await vectorStore.searchNotes(userInput);
            const savedMemories = await db.user_profile.toArray();

            let systemContext = "Knowledge Base:";
            if (relevantNotes.length > 0) {
                systemContext += "\n\nRelevant Notes:\n" +
                    relevantNotes.map((n: any) => `* ${n.title}: ${n.content}`).join("\n");
            }
            if (savedMemories.length > 0) {
                systemContext += "\n\nUser Profile Facts:\n" +
                    savedMemories.map(m => `* ${m.key}: ${m.value}`).join("\n");
            }

            try {
                const info = await getDeviceInfo();
                const locationPref = localStorage.getItem('PREF_LOCATION_ENABLED') === 'true';
                let locationString = "";

                if (locationPref) {
                    const loc = await getLocation();
                    if (loc) {
                        locationString = `Lat ${loc.latitude.toFixed(4)}, Lon ${loc.longitude.toFixed(4)}`;
                    }
                }

                systemContext += `\n\nDevice Context:\n* Local Time: ${info.time.toLocaleString()}\n* Timezone: ${info.timezone}\n* ISO Time: ${info.time.toISOString()}\n* Location: ${locationString || 'Not available'}\n* Online: ${info.online ? 'Yes' : 'No'}`;
            } catch (deviceError) {
                console.warn('Could not get device info', deviceError);
            }

            const systemMsg: Message = {
                role: 'system',
                content: `You are Kioku, a high-productivity AI memory assistant. 
Use Markdown for formatting. 
Current identity: Kioku. 
Capabilities: You can search user [Notes], manage [Reminders], and remember personal facts in [Memory].

If the user wants to set a reminder, include this exact tag at the end of your response:
[REMINDER: "description" AT "YYYY-MM-DD HH:MM"]
Use the user's local time provided in context for calculation.

Context:
${systemContext}`
            };

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            haptics.light();

            let assistantText = "";
            await llmService.chatCompletion([systemMsg, ...messages, userMsg], (text) => {
                assistantText = text;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last.role === 'assistant') {
                        return [...prev.slice(0, -1), { ...last, content: text }];
                    }
                    return prev;
                });
            });

            // Parse reminders from assistant text
            const reminderMatch = assistantText.match(/\[REMINDER:\s*"(.*)"\s*AT\s*"(.*)"\]/);
            if (reminderMatch) {
                const text = reminderMatch[1];
                const timeStr = reminderMatch[2];
                const dueAt = new Date(timeStr).getTime();

                if (!isNaN(dueAt)) {
                    // Check notification permission
                    if (!canNotify()) {
                        setMessages(prev => [...prev, {
                            role: 'system',
                            content: '⚠️ **Note:** Notifications are disabled. You won\'t get an alert for this reminder. Please enable them in Settings.'
                        }]);
                    }

                    await db.reminders.add({
                        text,
                        dueAt,
                        completed: false
                    });
                    console.log('Reminder set:', text, 'at', timeStr);
                    haptics.success();
                }
            }

            await db.chat_messages.add({
                conversationId,
                role: 'assistant',
                content: assistantText,
                timestamp: Date.now()
            });

            // Run rolling synthesis (background, non-blocking)
            const allMsgs = [...messages, userMsg, { role: 'assistant' as const, content: assistantText }];
            processRollingSynthesis(allMsgs, allMsgs.length);

        } catch (error) {
            console.error(error);
            const errorMsg = error instanceof Error ? error.message : 'Sorry, I encountered an unexpected error.';
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ **Error:** ${errorMsg}\n\nPlease check your API key and internet connection in Settings.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const suggestions = [
        "How do I use this app?",
        "Summary of my notes on AI",
        "Explain quantum computing",
        "Draft a follow-up email"
    ];

    if (messages.length === 0 && !isLoading) {
        return (
            <div className="chat-interface">
                <div className="landing-screen">
                    <header className="landing-header">
                        <h2>Welcome to Kioku</h2>
                        <p>Your AI assistant</p>
                    </header>

                    <div className="suggestions-container">
                        <h4>Try asking...</h4>
                        <div className="suggestion-chips">
                            {suggestions.map((s, i) => (
                                <button key={i} className="chip" onClick={() => handleSend(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="features-guide">
                        <div className="feature-card">
                            <span className="material-symbols-rounded">psychology</span>
                            <h5>Long-term Memory</h5>
                            <p>I remember your preferences and facts you share to personalize my help.</p>
                        </div>
                        <div className="feature-card">
                            <span className="material-symbols-rounded">description</span>
                            <h5>Note Integration</h5>
                            <p>I can search and reference your notes to provide contextual answers.</p>
                        </div>
                        <div className="feature-card">
                            <span className="material-symbols-rounded">edit_note</span>
                            <h5>Task Management</h5>
                            <p>Ask me to create notes, reminders, or summarize complex topics.</p>
                        </div>
                    </div>
                </div>

                <div className="chat-input-area">
                    {voiceError && <div className="voice-error-tooltip">{voiceError}</div>}
                    <MDInput
                        ref={inputRef}
                        label={isListening ? (interimTranscript || "Listening...") : "Message..."}
                        value={isListening ? interimTranscript : input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="chat-input-field"
                        disabled={isListening}
                    />
                    {isVoiceSupported && (
                        <MDButton
                            variant={isListening ? "filled" : "text"}
                            icon={isListening ? "mic" : "mic_none"}
                            onClick={isListening ? stopListening : startListening}
                            className={isListening ? "mic-button listening" : "mic-button"}
                        />
                    )}
                    <MDButton variant="filled" icon="send" onClick={() => handleSend()} disabled={isLoading || isListening} />
                </div>
            </div>
        );
    }

    return (
        <div className="chat-interface">
            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message-bubble message-bubble--${msg.role}`}>
                        <div className="message-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                {voiceError && <div className="voice-error-tooltip">{voiceError}</div>}
                <MDInput
                    ref={inputRef}
                    label={isListening ? (interimTranscript || "Listening...") : "Message..."}
                    value={isListening ? interimTranscript : input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="chat-input-field"
                    disabled={isListening}
                />
                {isVoiceSupported && (
                    <MDButton
                        variant={isListening ? "filled" : "text"}
                        icon={isListening ? "mic" : "mic_none"}
                        onClick={isListening ? stopListening : startListening}
                        className={isListening ? "mic-button listening" : "mic-button"}
                    />
                )}
                <MDButton variant="filled" icon="send" onClick={() => handleSend()} disabled={isLoading || isListening} />
            </div>
        </div>
    );
};
