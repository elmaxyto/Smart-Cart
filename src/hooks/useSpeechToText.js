(() => {

const { useState, useRef, useEffect } = SmartCart.hooks;
const { vibrate } = SmartCart;

const sanitizeVoiceTranscript = (rawText) => {
    const text = String(rawText || '')
        .replace(/[“”"'`]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[,.;:!?\-–—\s]+/, '')
        .replace(/[,.;:!?\-–—\s]+$/, '')
        .trim();

    return text;
};

function useSpeechToText({ onSpeechRecognized, showToast, locale = 'it-IT' } = {}) {
    const [isListening, setIsListening] = useState(false);
    const [voiceStatusMessage, setVoiceStatusMessage] = useState('');
    const [isSpeechRecognitionSupported] = useState(() => (
        typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    ));

    const recognitionRef = useRef(null);
    const shouldKeepListeningRef = useRef(false);
    const isRecognitionActiveRef = useRef(false);
    const restartTimerRef = useRef(null);

    const clearRestartTimer = () => {
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }
    };

    const scheduleRecognitionStart = (reason = 'manual', attempt = 0) => {
        const recognition = recognitionRef.current;
        if (!recognition || !shouldKeepListeningRef.current) return;

        if (isRecognitionActiveRef.current) {
            setIsListening(true);
            setVoiceStatusMessage('Ascolto attivo');
            return;
        }

        try {
            recognition.start();
            setVoiceStatusMessage('Avvio ascolto...');
        } catch (error) {
            const isInvalidState = error?.name === 'InvalidStateError';

            if (isInvalidState && attempt < 3) {
                try {
                    recognition.abort();
                } catch (_) {
                    // no-op
                }

                clearRestartTimer();
                restartTimerRef.current = setTimeout(() => {
                    scheduleRecognitionStart(reason, attempt + 1);
                }, 120);
                return;
            }

            shouldKeepListeningRef.current = false;
            isRecognitionActiveRef.current = false;
            setIsListening(false);

            const message = isInvalidState
                ? 'Riconoscimento vocale occupato. Riprova.'
                : 'Impossibile avviare input vocale';

            setVoiceStatusMessage(message);
            if (typeof showToast === 'function') {
                showToast({ type: 'error', message, duration: 3200 });
            }
        }
    };

    const forceRestartAndStart = (reason = 'manual') => {
        const recognition = recognitionRef.current;
        if (!recognition || !shouldKeepListeningRef.current) return;

        clearRestartTimer();

        try {
            recognition.abort();
        } catch (_) {
            // no-op
        }

        restartTimerRef.current = setTimeout(() => {
            scheduleRecognitionStart(reason);
        }, 80);
    };

    const ensureRecognitionInstance = (SpeechRecognition) => {
        if (recognitionRef.current) return recognitionRef.current;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = locale;

        recognition.onstart = () => {
            isRecognitionActiveRef.current = true;
            setIsListening(true);
            setVoiceStatusMessage('Ascolto attivo');
            vibrate(12);
        };

        recognition.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (!result.isFinal) continue;
                const transcript = result[0]?.transcript || '';
                const cleanedName = sanitizeVoiceTranscript(transcript);
                if (!cleanedName) continue;

                if (typeof onSpeechRecognized === 'function') {
                    onSpeechRecognized(cleanedName);
                }
                setVoiceStatusMessage(`Aggiunto: ${cleanedName}`);
                vibrate(8);
            }
        };

        recognition.onerror = (event) => {
            isRecognitionActiveRef.current = false;
            setIsListening(false);

            const errorMessages = {
                'not-allowed': 'Permesso microfono negato',
                'service-not-allowed': 'Permesso microfono negato',
                'audio-capture': 'Microfono non rilevato',
                'no-speech': 'Nessun parlato rilevato',
                'network': 'Errore di rete durante il riconoscimento'
            };

            const message = errorMessages[event.error] || 'Errore durante il riconoscimento vocale';
            setVoiceStatusMessage(message);
            if (typeof showToast === 'function') {
                showToast({ type: 'error', message, duration: 3200 });
            }

            shouldKeepListeningRef.current = false;
            clearRestartTimer();
            try {
                recognition.abort();
            } catch (_) {
                // no-op
            }
        };

        recognition.onend = () => {
            isRecognitionActiveRef.current = false;
            setIsListening(false);

            // Evita restart automatici fragili: il riavvio è sempre esplicito via click utente.
            shouldKeepListeningRef.current = false;
            clearRestartTimer();

            setVoiceStatusMessage((prev) => {
                if (!prev || prev === 'Avvio ascolto...' || prev === 'Ascolto attivo') {
                    return 'Ascolto terminato';
                }
                return prev;
            });
        };

        recognitionRef.current = recognition;
        return recognition;
    };

    const stopVoiceRecognition = (message) => {
        shouldKeepListeningRef.current = false;
        clearRestartTimer();
        isRecognitionActiveRef.current = false;

        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.abort();
            } catch (_) {
                // no-op
            }
        }

        setIsListening(false);
        setVoiceStatusMessage(message || 'Ascolto terminato');
    };

    const startVoiceRecognition = () => {
        if (!isSpeechRecognitionSupported) {
            setVoiceStatusMessage('Input vocale non supportato su questo browser');
            if (typeof showToast === 'function') {
                showToast({
                    type: 'info',
                    message: 'Input vocale non disponibile su questo browser',
                    duration: 3200
                });
            }
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceStatusMessage('Input vocale non supportato su questo browser');
            return;
        }

        ensureRecognitionInstance(SpeechRecognition);

        shouldKeepListeningRef.current = true;

        if (isRecognitionActiveRef.current || isListening) {
            setVoiceStatusMessage('Ascolto già attivo');
            return;
        }

        forceRestartAndStart('manual');
    };

    const toggleVoiceRecognition = () => {
        if (isListening) {
            stopVoiceRecognition('Ascolto terminato');
            return;
        }
        startVoiceRecognition();
    };

    useEffect(() => {
        if (!isSpeechRecognitionSupported) {
            setVoiceStatusMessage('Input vocale non supportato su questo browser');
        }
    }, [isSpeechRecognitionSupported]);

    useEffect(() => () => {
        clearRestartTimer();
        shouldKeepListeningRef.current = false;
        isRecognitionActiveRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onstart = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            try {
                recognitionRef.current.abort();
            } catch (_) {
                // no-op
            }
        }
    }, []);

    return {
        isListening,
        voiceStatusMessage,
        isSpeechRecognitionSupported,
        toggleVoiceRecognition,
        startVoiceRecognition,
        stopVoiceRecognition
    };
}

SmartCart.CustomHooks = {
    ...(SmartCart.CustomHooks || {}),
    useSpeechToText
};

window.SmartCart = SmartCart;

})();