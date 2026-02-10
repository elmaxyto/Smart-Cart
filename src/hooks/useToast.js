(() => {

const { useState, useRef, useEffect } = SmartCart.hooks;

function useToast() {
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = ({ type = 'info', message = '', actionLabel, onAction, duration = 2400 }) => {
        if (!message) return;

        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }

        const id = Date.now() + Math.random();
        setToast({ id, type, message, actionLabel, onAction });

        toastTimerRef.current = setTimeout(() => {
            setToast((prev) => (prev?.id === id ? null : prev));
        }, duration);
    };

    const closeToast = () => {
        setToast(null);
    };

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    return {
        toast,
        showToast,
        closeToast,
        setToast
    };
}

SmartCart.CustomHooks = {
    ...(SmartCart.CustomHooks || {}),
    useToast
};

window.SmartCart = SmartCart;

})();