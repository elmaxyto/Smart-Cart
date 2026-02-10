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

    const stopVoiceRecognition = (message) => {
        shouldKeepListeningRef.current = false;
        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.stop();
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

        if (!recognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = locale;

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
                shouldKeepListeningRef.current = false;
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

                try {
                    recognition.stop();
                } catch (_) {
                    // no-op
                }
            };

            recognition.onend = () => {
                if (shouldKeepListeningRef.current) {
                    try {
                        recognition.start();
                        setIsListening(true);
                        setVoiceStatusMessage('Ascolto attivo');
                        return;
                    } catch (_) {
                        shouldKeepListeningRef.current = false;
                        setIsListening(false);
                        setVoiceStatusMessage('Errore riavvio ascolto');
                    }
                }
                setIsListening(false);
                setVoiceStatusMessage((prev) => prev || 'Ascolto terminato');
            };

            recognitionRef.current = recognition;
        }

        shouldKeepListeningRef.current = true;

        try {
            recognitionRef.current.start();
            setIsListening(true);
            setVoiceStatusMessage('Ascolto attivo');
            vibrate(12);
        } catch (error) {
            if (error?.name !== 'InvalidStateError') {
                setIsListening(false);
                shouldKeepListeningRef.current = false;
                setVoiceStatusMessage('Impossibile avviare input vocale');
                if (typeof showToast === 'function') {
                    showToast({ type: 'error', message: 'Impossibile avviare input vocale', duration: 3000 });
                }
            }
        }
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
        shouldKeepListeningRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            try {
                recognitionRef.current.stop();
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