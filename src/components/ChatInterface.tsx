import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { llmService, type Message } from '../services/llm';
import { vectorStore } from '../services/vectorStore';
import { webSearchService } from '../services/webSearch';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MDInput } from './common/MDInput';
import { MDButton } from './common/MDButton';
import { MDDialog } from './common/MDDialog';
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
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorDialogMessage, setErrorDialogMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isInitialLoad = useRef(true);
    const prevConvId = useRef(conversationId);

    const {
        isListening,
        combinedTranscript,
        isSupported: isVoiceSupported,
        error: voiceError,
        startListening,
        stopListening,
        resetTranscript
    } = useVoiceInput();

    const [lastVoiceText, setLastVoiceText] = useState('');

    // Commit voice transcript when listening stops
    useEffect(() => {
        if (!isListening && lastVoiceText) {
            setInput(prev => {
                const base = prev.trim();
                return base ? `${base} ${lastVoiceText}` : lastVoiceText;
            });
            setLastVoiceText('');
            resetTranscript();
        } else if (isListening) {
            setLastVoiceText(combinedTranscript);
        }
    }, [isListening, combinedTranscript, resetTranscript, lastVoiceText]);

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
                await db.ai_memory.put({
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
                        await db.ai_memory.put({
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
            const savedMemories = await db.ai_memory.toArray();

            let systemContext = "Knowledge Base:";
            if (relevantNotes.length > 0) {
                systemContext += "\n\nRelevant Notes:\n" +
                    relevantNotes.map((n: any) => `* ${n.title}: ${n.content}`).join("\n");
            }
            if (savedMemories.length > 0) {
                systemContext += "\n\nUser Profile Facts:\n" +
                    savedMemories.map(m => `* ${m.key}: ${m.value}`).join("\n");
            }

            // Perform web search if enabled
            const webSearchEnabled = localStorage.getItem('PREF_WEB_SEARCH_ENABLED') === 'true';
            if (webSearchEnabled) {
                try {
                    const searchResults = await webSearchService.search(userInput, 5);
                    if (searchResults.length > 0) {
                        systemContext += webSearchService.formatResultsForContext(searchResults);
                    }
                } catch (searchError) {
                    console.warn('Web search failed:', searchError);
                    // Continue without web search results - don't break the chat
                }
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

Core Mission & Capabilities:
1. Unified Chat: Expert in natural conversation and voice interaction.
2. Intelligent Memory: Automatically learn facts and preferences about the user from conversation. Support explicit memory commands like "Remember that...".
3. Notes & Knowledge: Search and reference user notes using vector embeddings. Support markdown for rich note content.
4. Smart Reminders: Create reminders from natural language using the exact tag: [REMINDER: "description" AT "YYYY-MM-DD HH:MM"]. Use the user's local time provided in context for calculation.
5. Web Search: If enabled, search the web for real-time info and cite sources with URLs.

Always guide users on how to use these features properly when asked.

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
            console.error('LLM Connection Error:', error);
            const errorMsg = error instanceof Error ? error.message : 'Sorry, I encountered an unexpected error.';

            // Specific diagnosis based on error string
            let diagnosis = "Please check your API key and internet connection.";
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
                diagnosis = "This is likely a Network or CORS issue. Some browsers block direct AI requests. Try using **OpenRouter** which is optimized for web browsers.";
            } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                diagnosis = "Your API key appears to be invalid or expired. Please check your settings.";
            } else if (errorMsg.includes('429')) {
                diagnosis = "Rate limit exceeded. Please wait a moment or try a different provider.";
            }

            setErrorDialogMessage(
                `### Connection Failed\n\n**Error:** ${errorMsg}\n\n**Suggestion:** ${diagnosis}`
            );
            setErrorDialogOpen(true);

            // Create a persistent error message in chat
            const persistentErrorContent = `❌ **Connection Error**
            
**Details:** ${errorMsg}

**Recommendation:** ${diagnosis}

**Troubleshooting:**
1. Check your API key in Settings
2. Verify your AI provider selection
3. Ensure you have an active internet connection

This error has been saved to your chat history for reference.`;

            // Save error message to database so it persists
            await db.chat_messages.add({
                conversationId,
                role: 'assistant',
                content: persistentErrorContent,
                timestamp: Date.now()
            });

            // Update conversation timestamp
            await db.conversations.update(conversationId, { updatedAt: Date.now() });

            // Remove any empty assistant message that was added for streaming
            // The error message will be synced from database via useLiveQuery
            setMessages(prev => {
                return prev.filter((msg, idx) => {
                    // Remove empty assistant messages (from streaming setup)
                    if (msg.role === 'assistant' && !msg.content && idx === prev.length - 1) {
                        return false;
                    }
                    return true;
                });
            });
        } finally {
            setIsLoading(false);
        }
    };

    const suggestions = [
        "How do I use Kioku?",
        "Summary of my notes on AI",
        "Explain quantum computing",
        "Tell me about my personal facts"
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
                        label={isListening ? "Listening..." : "Message..."}
                        value={isListening ? (input ? `${input} ${combinedTranscript}` : combinedTranscript) : input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="chat-input-field"
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
                            {isLoading && msg.role === 'assistant' && idx === messages.length - 1 && (
                                <div className="typing-indicator">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                {voiceError && <div className="voice-error-tooltip">{voiceError}</div>}
                <MDInput
                    ref={inputRef}
                    label={isListening ? "Listening..." : "Message..."}
                    value={isListening ? (input ? `${input} ${combinedTranscript}` : combinedTranscript) : input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="chat-input-field"
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

            <MDDialog
                isOpen={errorDialogOpen}
                onClose={() => setErrorDialogOpen(false)}
                title="Connection Problem"
                message={errorDialogMessage}
                icon="error"
            />
        </div>
    );
};
