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

    const ensureRecognitionInstance = (SpeechRecognition) => {
        if (recognitionRef.current) return recognitionRef.current;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = locale;

        recognition.onstart = () => {
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
                vibrate(8);
            }
        };

        recognition.onerror = (event) => {
            if (event?.error === 'aborted') {
                return;
            }

            const errorMessages = {
                'not-allowed': 'Permesso microfono negato',
                'service-not-allowed': 'Permesso microfono negato',
                'audio-capture': 'Microfono non rilevato',
                'no-speech': 'Nessun parlato rilevato',
                'network': 'Errore di rete durante il riconoscimento'
            };

            const message = errorMessages[event?.error];
            if (!message) {
                return;
            }

            if (typeof showToast === 'function') {
                showToast({ type: 'error', message, duration: 3200 });
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            setVoiceStatusMessage('Ascolto terminato');
        };

        recognitionRef.current = recognition;
        return recognition;
    };

    const stopVoiceRecognition = (message) => {
        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.stop();
            } catch (_) {
                // no-op
            }
        }
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

        try {
            recognitionRef.current.start();
        } catch (error) {
            if (error?.name === 'InvalidStateError') {
                return;
            }

            if (typeof showToast === 'function') {
                showToast({
                    type: 'error',
                    message: 'Impossibile avviare input vocale',
                    duration: 3200
                });
            }
        }
    };

    const toggleVoiceRecognition = () => {
        if (isListening) {
            stopVoiceRecognition();
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
        stopVoiceRecognition,
        start: startVoiceRecognition,
        stop: stopVoiceRecognition
    };
}

SmartCart.CustomHooks = {
    ...(SmartCart.CustomHooks || {}),
    useSpeechToText
};

window.SmartCart = SmartCart;

})();