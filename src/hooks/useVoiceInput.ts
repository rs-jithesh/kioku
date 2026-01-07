import { useState, useCallback, useRef, useEffect } from 'react';
import { haptics } from '../services/deviceCapabilities';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface UseVoiceInputReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    isSupported: boolean;
    error: string | null;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const isSecureContext = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'https:'
    );

    useEffect(() => {
        if (!isSupported) {
            console.warn('Speech recognition is not supported in this browser.');
            return;
        }

        if (!isSecureContext) {
            console.warn('Speech recognition requires a secure context (HTTPS or localhost).');
            setError('Browser requires HTTPS for voice input');
            return;
        }

        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionClass();

        const savedLang = localStorage.getItem('PREF_VOICE_LANG') || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = savedLang;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
            haptics.light();
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimResult = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimResult += result[0].transcript;
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + finalTranscript);
                setInterimTranscript('');
            } else {
                setInterimTranscript(interimResult);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setError(event.error);
            setIsListening(false);
            haptics.error();
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript('');
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [isSupported]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || isListening) return;

        try {
            setError(null);
            recognitionRef.current.start();
        } catch (e) {
            console.error('Failed to start speech recognition:', e);
            setError('Failed to start');
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || !isListening) return;

        recognitionRef.current.stop();
        haptics.medium();
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        isSupported,
        error,
        startListening,
        stopListening,
        resetTranscript,
    };
}
