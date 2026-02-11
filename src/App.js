(() => {

const { useState, useEffect, useRef, useMemo } = SmartCart.hooks;
const { Icons, vibrate, Components, CategoryManager, CustomHooks = {} } = SmartCart;
const { useToast, useSpeechToText } = CustomHooks;
const {
    ProgressBar,
    FilterBar,
    ItemCard,
    ModalImport,
    ModalLinkImport,
    ModalItem,
    ModalCategoryManager,
    ModalLoyaltyCards,
    ModalTarget,
    Scanner,
    Toast
} = Components;
const {
    UNCATEGORIZED_ID,
    loadCategories,
    saveCategories,
    migrateItemsAndCategories,
    resolveCategoryForItem,
    getFilterCategories,
    addCategory,
    updateCategory,
    removeCategory
} = CategoryManager;

const STORAGE_KEY_ITEMS = 'smartcart_items';
const STORAGE_KEY_TARGET = 'smartcart_target';
const STORAGE_KEY_THEME = 'smartcart_theme';
const STORAGE_KEY_LOYALTY_CARDS = 'smartcart_loyalty_cards';
const SUGGESTIONS_URL = './assets/suggestions.json';
const SHARE_APP_NAME = 'SmartCart';
const SHARE_PAYLOAD_VERSION = 1;
const SHARE_MIN_SUPPORTED_VERSION = 1;
const SHARE_MAX_SUPPORTED_VERSION = SHARE_PAYLOAD_VERSION;
const SHARE_MAX_ITEMS = 1000;
const SHARE_MAX_ENCODED_LENGTH = 120000;

const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const DEFAULT_SUGGESTIONS = [
    'Pane', 'Latte', 'Uova', 'Pasta', 'Riso', 'Pomodori', 'Banane', 'Mele', 'Acqua', 'Caffè',
    'Yogurt', 'Mozzarella', 'Parmigiano', 'Petto di pollo', 'Tonno', 'Patate', 'Zucchine',
    'Insalata', 'Biscotti', 'Detersivo', 'Carta igienica', 'Shampoo'
];

const getStoredThemePreference = () => {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    return stored === THEME_LIGHT || stored === THEME_DARK ? stored : null;
};

const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
    }
    return THEME_LIGHT;
};

const getInitialData = () => {
    let storedItems = [];
    try {
        storedItems = JSON.parse(localStorage.getItem(STORAGE_KEY_ITEMS)) || [];
    } catch (e) {
        storedItems = [];
    }

    const storedCategories = loadCategories();
    return migrateItemsAndCategories(storedItems, storedCategories);
};

const loadStoredLoyaltyCards = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_LOYALTY_CARDS) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((card) => card && typeof card === 'object')
            .map((card) => ({
                id: String(card.id || `${Date.now()}-${Math.random()}`),
                name: String(card.name || '').trim(),
                code: String(card.code || '').trim(),
                type: card.type === 'qr' ? 'qr' : 'barcode',
                createdAt: Number(card.createdAt) || Date.now()
            }))
            .filter((card) => card.name && card.code);
    } catch (error) {
        return [];
    }
};

const normalizeSuggestions = (input) => {
    if (!Array.isArray(input)) return DEFAULT_SUGGESTIONS;
    const unique = [...new Set(input
        .map((entry) => String(entry || '').trim())
        .filter((entry) => entry.length > 1))];
    return unique.length ? unique : DEFAULT_SUGGESTIONS;
};

const normalizePrice = (value) => {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const extractPriceCandidates = (text) => {
    const matches = text.match(/\b\d{1,4}(?:[.,]\d{1,2})?\b/g) || [];
    return matches
        .map((m) => {
            const [intPart, decPart = ''] = m.replace(',', '.').split('.');
            const normalizedDec = decPart.length === 1 ? `${decPart}0` : decPart.slice(0, 2);
            return Number(`${intPart}.${normalizedDec || '00'}`);
        })
        .filter((n) => Number.isFinite(n) && n > 0 && n < 10000);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toSafeString = (value, fallback = '') => {
    if (typeof value === 'string') {
        const cleaned = value.replace(/\s+/g, ' ').trim();
        return cleaned || fallback;
    }
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
};

const toSafeNumber = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed, min, max);
};

const toSafeBoolean = (value) => Boolean(value);
const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const toShareItem = (item) => ({
    name: toSafeString(item?.name, 'Prodotto').slice(0, 160),
    categoryId: toSafeString(item?.categoryId, '').slice(0, 80),
    price: toSafeNumber(item?.price, { min: 0, max: 999999, fallback: 0 }),
    discount: toSafeNumber(item?.discount, { min: 0, max: 100, fallback: 0 }),
    checked: toSafeBoolean(item?.checked)
});

const sanitizeShareItems = (items) => (
    (Array.isArray(items) ? items : [])
        .filter(isObjectLike)
        .slice(0, SHARE_MAX_ITEMS)
        .map(toShareItem)
);

const buildSharePayload = (items) => ({
    app: SHARE_APP_NAME,
    version: SHARE_PAYLOAD_VERSION,
    items: sanitizeShareItems(items)
});

const encodePayloadForUrl = (payload) => {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const decodePayloadFromUrl = (encoded) => {
    try {
        const rawEncoded = toSafeString(encoded, '');
        if (!rawEncoded) throw new Error('Payload assente');
        if (rawEncoded.length > SHARE_MAX_ENCODED_LENGTH) throw new Error('Payload troppo grande');

        const base64 = rawEncoded.replace(/-/g, '+').replace(/_/g, '/');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Codifica non valida');

        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const json = new TextDecoder().decode(bytes);
        const data = JSON.parse(json);

        if (!isObjectLike(data) || data.app !== SHARE_APP_NAME) throw new Error('Formato applicazione non valido');

        const version = Number(data.version);
        if (!Number.isInteger(version)) throw new Error('Versione formato non valida');
        if (version > SHARE_MAX_SUPPORTED_VERSION) throw new Error('Versione formato non supportata');
        if (version < SHARE_MIN_SUPPORTED_VERSION) throw new Error('Versione formato obsoleta');
        if (!Array.isArray(data.items)) throw new Error('Lista elementi non valida');

        return {
            app: SHARE_APP_NAME,
            version,
            items: sanitizeShareItems(data.items)
        };
    } catch {
        throw new Error('Payload di condivisione non valido');
    }
};

function App() {
    const [initialData] = useState(() => getInitialData());
    const [items, setItems] = useState(() => initialData.items);
    const [categories, setCategories] = useState(() => initialData.categories);
    const [targetAmount, setTargetAmount] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEY_TARGET)) || 20.00);
    const [themePreference, setThemePreference] = useState(() => getStoredThemePreference());
    const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
    const [activeTab, setActiveTab] = useState('cart');
    const [activeCategory, setActiveCategory] = useState('all');
    const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
    const [loyaltyCards, setLoyaltyCards] = useState(() => loadStoredLoyaltyCards());

    const [isScanning, setIsScanning] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showTargetEdit, setShowTargetEdit] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showLoyaltyCards, setShowLoyaltyCards] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [ocrStatus, setOcrStatus] = useState('');
    const [ocrProgress, setOcrProgress] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [pendingLinkImport, setPendingLinkImport] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const clearConfirmUntilRef = useRef(0);
    const importFromLinkHandledRef = useRef(false);
    const currentTheme = themePreference || systemTheme;

    const { toast, showToast, closeToast } = useToast();

    const cleanImportQueryParam = () => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (!url.searchParams.has('data')) return;
        url.searchParams.delete('data');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    const handleSpeechRecognized = (cleanedName) => {
        setItems((prev) => [{
            id: Date.now() + Math.random(),
            name: cleanedName,
            categoryId: '',
            price: 0,
            discount: 0,
            checked: false
        }, ...prev]);
        setActiveTab('todo');
    };

    const {
        isListening,
        voiceStatusMessage,
        isSpeechRecognitionSupported,
        toggleVoiceRecognition
    } = useSpeechToText({
        onSpeechRecognized: handleSpeechRecognized,
        showToast
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
        localStorage.setItem(STORAGE_KEY_TARGET, String(targetAmount));
    }, [items, targetAmount]);

    useEffect(() => {
        saveCategories(categories);
    }, [categories]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_LOYALTY_CARDS, JSON.stringify(loyaltyCards));
    }, [loyaltyCards]);

    useEffect(() => {
        if (themePreference) localStorage.setItem(STORAGE_KEY_THEME, themePreference);
        else localStorage.removeItem(STORAGE_KEY_THEME);
    }, [themePreference]);

    useEffect(() => {
        fetch(SUGGESTIONS_URL)
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('not-found')))
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.items;
                setSuggestions(normalizeSuggestions(list));
            })
            .catch(() => setSuggestions(DEFAULT_SUGGESTIONS));
    }, []);

    useEffect(() => {
        if (!(typeof window !== 'undefined' && window.matchMedia)) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemThemeChange = (event) => setSystemTheme(event.matches ? THEME_DARK : THEME_LIGHT);

        setSystemTheme(mediaQuery.matches ? THEME_DARK : THEME_LIGHT);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', onSystemThemeChange);
            return () => mediaQuery.removeEventListener('change', onSystemThemeChange);
        }

        mediaQuery.addListener(onSystemThemeChange);
        return () => mediaQuery.removeListener(onSystemThemeChange);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }, [currentTheme]);

    useEffect(() => {
        if (importFromLinkHandledRef.current || typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search || '');
        const encodedData = params.get('data');
        if (!encodedData) return;
        importFromLinkHandledRef.current = true;

        try {
            const payload = decodePayloadFromUrl(encodedData);
            if (!payload.items.length) throw new Error('Lista condivisa vuota');
            setPendingLinkImport({ source: 'url', items: payload.items, count: payload.items.length });
        } catch {
            showToast({ type: 'error', message: 'Link non valido o dati di condivisione corrotti', duration: 3400 });
            cleanImportQueryParam();
        }
    }, []);

    useEffect(() => {
        let streamObj = null;
        if (isScanning) {
            const initCam = async () => {
                try {
                    setOcrStatus('Apertura fotocamera...');
                    streamObj = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
                    if (videoRef.current) {
                        videoRef.current.srcObject = streamObj;
                        await videoRef.current.play();
                    }
                    setOcrStatus('Inquadra prezzo e nome');
                } catch {
                    showToast({ type: 'error', message: 'Errore fotocamera: verifica i permessi del browser.', duration: 3200 });
                    setIsScanning(false);
                }
            };
            initCam();
        }
        return () => {
            if (streamObj) streamObj.getTracks().forEach((t) => t.stop());
        };
    }, [isScanning]);

    const filterCategories = useMemo(() => getFilterCategories(categories), [categories]);
    const assignableCategories = useMemo(() => categories.filter((cat) => cat.id !== UNCATEGORIZED_ID), [categories]);

    const filteredItems = useMemo(() => (
        activeCategory === 'all'
            ? items
            : items.filter((i) => resolveCategoryForItem(i, categories).id === activeCategory)
    ), [items, activeCategory, categories]);

    const cartItems = useMemo(() => filteredItems.filter((i) => i.price > 0), [filteredItems]);
    const todoItems = useMemo(() => filteredItems.filter((i) => !i.price || i.price === 0), [filteredItems]);
    const total = useMemo(
        () => items.filter((i) => i.price > 0).reduce((acc, i) => acc + (i.price * (1 - (i.discount || 0) / 100)), 0),
        [items]
    );

    const applyLinkImport = (mode = 'merge') => {
        if (!pendingLinkImport?.items?.length) {
            setPendingLinkImport(null);
            cleanImportQueryParam();
            return;
        }

        const importedItems = pendingLinkImport.items.map((item, index) => ({ ...item, id: Date.now() + index + Math.random() }));
        if (mode === 'replace') setItems(importedItems);
        else setItems((prev) => [...importedItems, ...prev]);

        setActiveTab('todo');
        setPendingLinkImport(null);
        showToast({ type: 'success', message: mode === 'replace' ? `Lista sostituita con ${importedItems.length} elementi` : `Aggiunti ${importedItems.length} elementi dal link`, duration: 3200 });
        cleanImportQueryParam();
    };

    const handleDeleteItem = (id) => {
        const removedIndex = items.findIndex((i) => i.id === id);
        const removedItem = removedIndex >= 0 ? items[removedIndex] : null;
        if (removedIndex >= 0) setItems((prev) => prev.filter((i) => i.id !== id));

        if (removedItem) {
            showToast({
                type: 'success',
                message: `Eliminato: ${removedItem.name}`,
                actionLabel: 'Annulla',
                onAction: () => {
                    setItems((prev) => {
                        const next = [...prev];
                        next.splice(Math.max(0, Math.min(removedIndex, next.length)), 0, removedItem);
                        return next;
                    });
                    closeToast();
                    showToast({ type: 'info', message: 'Elemento ripristinato', duration: 2000 });
                },
                duration: 4200
            });
        }
        vibrate(10);
    };

    const toggleChecked = (id) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
        vibrate(5);
    };

    const handleQuickCategoryChange = (id, categoryId) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, categoryId: String(categoryId || '').trim() } : i)));
    };

    const toggleTheme = () => {
        setThemePreference((prev) => (prev || systemTheme) === THEME_DARK ? THEME_LIGHT : THEME_DARK);
        vibrate(5);
    };

    const handleSaveItem = (data) => {
        const prepared = {
            ...data,
            name: (data.name || '').trim() || 'Nuovo prodotto',
            categoryId: String(data.categoryId || '').trim(),
            price: normalizePrice(data.price),
            discount: Number(data.discount) || 0
        };

        if (prepared.isNew) {
            setItems((prev) => [{ ...prepared, id: Date.now(), checked: false }, ...prev]);
            showToast({ type: 'success', message: `Aggiunto: ${prepared.name}` });
            vibrate(10);
        } else {
            setItems((prev) => prev.map((i) => (i.id === prepared.id ? { ...i, ...prepared } : i)));
            showToast({ type: 'info', message: `Aggiornato: ${prepared.name}` });
        }

        setEditingItem(null);
        setShowManualAdd(false);
        setIsScanning(false);
    };

    const handleImport = (text) => {
        const fragments = text.split(/[\n,;]/);
        const cleaned = [...new Set(fragments.map((f) => {
            let c = f.trim();
            c = c.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
            c = c.replace(/^[\d\s.•\-\*)]+/, '');
            c = c.replace(/^(\d+\s*[xX]?\s*)/, '');
            return c.trim();
        }).filter((n) => n.length > 1))];

        if (!cleaned.length) {
            showToast({ type: 'error', message: 'Nessun elemento valido da importare', duration: 3000 });
            return;
        }

        setItems((prev) => [
            ...cleaned.map((n) => ({ id: Math.random() + Date.now(), name: n, categoryId: '', price: 0, discount: 0, checked: false })),
            ...prev
        ]);
        setShowImport(false);
        setActiveTab('todo');
        showToast({ type: 'success', message: `${cleaned.length} prodotti importati`, duration: 3000 });
        vibrate(30);
    };

    const handleClearAll = () => {
        if (!items.length) {
            showToast({ type: 'info', message: 'La lista è già vuota' });
            return;
        }

        const now = Date.now();
        if (now <= clearConfirmUntilRef.current) {
            const deletedCount = items.length;
            setItems([]);
            clearConfirmUntilRef.current = 0;
            showToast({ type: 'success', message: `Eliminati ${deletedCount} elementi`, duration: 3000 });
            return;
        }

        clearConfirmUntilRef.current = now + 4000;
        showToast({ type: 'info', message: 'Tocca di nuovo il cestino entro 4 secondi per svuotare tutto', duration: 3400 });
    };

    const exportCsv = () => {
        const rows = [
            ['nome', 'categoria', 'prezzo', 'sconto', 'prezzo_finale', 'checked'],
            ...items.map((i) => [
                i.name,
                resolveCategoryForItem(i, categories).name,
                (i.price || 0).toFixed(2),
                Number(i.discount || 0),
                (i.price * (1 - (i.discount || 0) / 100) || 0).toFixed(2),
                i.checked ? 'si' : 'no'
            ])
        ];

        const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `smartcart-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const shareListByLink = async () => {
        if (!items.length) {
            showToast({ type: 'info', message: 'Aggiungi almeno un elemento prima di condividere' });
            return;
        }

        try {
            const payload = buildSharePayload(items);
            const encodedData = encodePayloadForUrl(payload);
            const absoluteLink = `${window.location.origin}/?data=${encodedData}`;

            if (typeof navigator.share === 'function') {
                await navigator.share({ title: 'SmartCart', text: 'Ecco la mia lista SmartCart', url: absoluteLink });
                showToast({ type: 'success', message: 'Condivisione completata' });
                vibrate(10);
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(absoluteLink);
                showToast({ type: 'success', message: 'Link copiato negli appunti' });
                vibrate(10);
                return;
            }

            window.prompt('Copia questo link per condividere la lista', absoluteLink);
            showToast({ type: 'info', message: 'Copia manualmente il link dalla finestra' });
        } catch {
            showToast({ type: 'error', message: 'Impossibile generare il link di condivisione', duration: 3200 });
        }
    };

    const handleAddCategory = (draft) => {
        try {
            setCategories((prev) => addCategory(prev, draft));
            showToast({ type: 'success', message: `Categoria creata: ${draft.name}` });
        } catch (error) {
            showToast({ type: 'error', message: error.message || 'Errore creazione categoria' });
        }
    };

    const handleUpdateCategory = (categoryId, patch) => {
        try {
            setCategories((prev) => updateCategory(prev, categoryId, patch));
        } catch (error) {
            showToast({ type: 'error', message: error.message || 'Errore aggiornamento categoria' });
        }
    };

    const handleDeleteCategory = (categoryId) => {
        try {
            setCategories((prevCats) => {
                const result = removeCategory(prevCats, items, categoryId);
                setItems(result.items);
                return result.categories;
            });
            if (activeCategory === categoryId) setActiveCategory('all');
            showToast({ type: 'info', message: 'Categoria eliminata. Elementi riassegnati ad Altro.' });
        } catch (error) {
            showToast({ type: 'error', message: error.message || 'Errore eliminazione categoria' });
        }
    };

    const captureOCR = async () => {
        if (!videoRef.current) return;
        vibrate();
        setProcessing(true);
        setOcrProgress(5);
        setOcrStatus('Cattura frame...');

        try {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

            setOcrStatus('OCR in corso...');
            setOcrProgress(15);

            const { data: { text } } = await Tesseract.recognize(canvas, 'ita', {
                logger: ({ progress }) => {
                    if (typeof progress === 'number') setOcrProgress(15 + progress * 70);
                }
            });

            setOcrStatus('Parsing testo...');
            setOcrProgress(92);

            const rawLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
            const cleanLines = [...new Set(rawLines.filter((line) => !/^\W+$/.test(line)))].slice(0, 25);
            const prices = extractPriceCandidates(text);
            const suggestedName = cleanLines.find((line) => !/\d/.test(line)) || cleanLines[0] || '';
            const suggestedPrice = prices.length ? prices[0].toFixed(2) : '';

            setEditingItem((prev) => ({
                ...(prev || {}),
                isNew: !prev?.id,
                name: prev?.name || suggestedName || '',
                price: prev?.price || suggestedPrice,
                categoryId: prev?.categoryId || '',
                detectedLines: cleanLines,
                ocrFallback: !suggestedName && !suggestedPrice
            }));

            setOcrProgress(100);
            setIsScanning(false);
            setShowManualAdd(true);
        } catch (err) {
            showToast({ type: 'error', message: 'Errore OCR: prova con inserimento manuale.', duration: 3200 });
            console.error(err);
        } finally {
            setProcessing(false);
            setTimeout(() => {
                setOcrStatus('');
                setOcrProgress(0);
            }, 250);
        }
    };

    return (
        <div className="max-w-md mx-auto min-h-screen pb-24 relative overflow-hidden flex flex-col bg-gray-50">
            <header className="bg-white p-4 pt-6 pb-0 sticky top-0 z-20 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Icons.Cart size={20} /></div>
                        SmartCart
                    </h1>
                    <div className="flex gap-1">
                        <button onClick={() => setShowCategoryManager(true)} title="Categorie" className="p-2 text-gray-400 active:text-blue-600"><Icons.Settings size={20} /></button>
                        <button onClick={() => setShowLoyaltyCards(true)} title="Carte fedeltà" className="p-2 text-gray-400 active:text-blue-600"><Icons.Card size={20} /></button>
                        <button onClick={toggleTheme} title={currentTheme === THEME_DARK ? 'Passa al tema chiaro' : 'Passa al tema scuro'} className="p-2 text-gray-400 active:text-blue-600">
                            {currentTheme === THEME_DARK ? <Icons.Sun size={20} /> : <Icons.Moon size={20} />}
                        </button>
                        <button onClick={shareListByLink} title="Condividi lista" className="p-2 text-gray-400 active:text-blue-600"><Icons.Share size={20} /></button>
                        <button onClick={exportCsv} title="Esporta CSV" className="p-2 text-gray-400 active:text-blue-600"><Icons.Download size={20} /></button>
                        <button onClick={() => setShowImport(true)} title="Importa" className="p-2 text-gray-400 active:text-blue-600"><Icons.Clipboard size={22} /></button>
                        <button onClick={handleClearAll} title="Svuota" className="p-2 text-gray-400 active:text-red-500"><Icons.Trash size={22} /></button>
                    </div>
                </div>

                <div className="flex">
                    <button onClick={() => setActiveTab('cart')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === 'cart' ? 'tab-active' : 'text-gray-400'}`}>
                        Carrello ({cartItems.length})
                    </button>
                    <button onClick={() => setActiveTab('todo')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === 'todo' ? 'tab-active' : 'text-gray-400'}`}>
                        Lista spesa ({todoItems.length})
                    </button>
                </div>
            </header>

            <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'cart' && <ProgressBar total={total} target={targetAmount} onEditTarget={() => setShowTargetEdit(true)} />}
                <FilterBar categories={filterCategories} value={activeCategory} onChange={setActiveCategory} />

                <main className="space-y-3 mt-1">
                    {(activeTab === 'cart' ? cartItems : todoItems).length === 0 ? (
                        <div className="text-center py-14 px-4 flex flex-col items-center bg-white border border-dashed border-gray-300 rounded-2xl">
                            <div className="text-gray-300">{activeTab === 'cart' ? <Icons.Cart size={56}/> : <Icons.Clipboard size={56}/>}</div>
                            <p className="mt-4 font-black text-sm text-gray-700">{activeTab === 'cart' ? 'Il carrello è vuoto' : 'Nessun prodotto in lista'}</p>
                            <p className="mt-1 text-xs text-gray-500 font-bold">
                                {activeCategory === 'all' ? 'Aggiungi un elemento o importa una lista per iniziare.' : 'Nessun elemento trovato con il filtro categoria selezionato.'}
                            </p>
                            <div className="mt-4 flex gap-2">
                                {activeCategory !== 'all' && (
                                    <button onClick={() => setActiveCategory('all')} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-wider">Reset filtro</button>
                                )}
                                <button
                                    onClick={() => { setEditingItem({ isNew: true, name: '', categoryId: '', price: 0, discount: 0 }); setShowManualAdd(true); }}
                                    className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider"
                                >
                                    + Aggiungi
                                </button>
                            </div>
                        </div>
                    ) : (
                        (activeTab === 'cart' ? cartItems : todoItems).map((i) => (
                            <ItemCard
                                key={i.id}
                                item={i}
                                category={resolveCategoryForItem(i, categories)}
                                categories={assignableCategories}
                                onEdit={() => setEditingItem(i)}
                                onDelete={handleDeleteItem}
                                onToggleCheck={toggleChecked}
                                onCategoryChange={handleQuickCategoryChange}
                            />
                        ))
                    )}
                </main>
            </div>

            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto z-30">
                {activeTab === 'todo' && voiceStatusMessage && (
                    <div className="mb-2 px-3 py-2 rounded-xl bg-white border border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-500 text-center">
                        {voiceStatusMessage}
                    </div>
                )}
                <div className="flex gap-3">
                    <button onClick={() => { setEditingItem({ isNew: true, name: '', categoryId: '', price: 0, discount: 0 }); setShowManualAdd(true); }} className="flex-1 bg-white text-gray-800 py-4 rounded-3xl shadow-xl font-black text-sm uppercase tracking-wider border border-gray-100 active:scale-95 transition-transform">+ Manuale</button>
                    <button onClick={() => setIsScanning(true)} className="flex-[1.4] bg-blue-600 text-white py-4 rounded-3xl shadow-xl shadow-blue-200 font-black text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2"><Icons.Camera size={18}/> Scansiona</button>
                    {activeTab === 'todo' && (
                        <button
                            onClick={toggleVoiceRecognition}
                            title={isListening ? 'Ferma input vocale' : 'Avvia input vocale'}
                            disabled={!isSpeechRecognitionSupported}
                            className={`shrink-0 py-4 px-4 rounded-3xl shadow-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2 ${isListening ? 'bg-red-500 text-white' : 'bg-white text-gray-700 border border-gray-100'} ${!isSpeechRecognitionSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Icons.Mic size={18} />
                        </button>
                    )}
                </div>
            </div>

            {(showManualAdd || editingItem) && (
                <ModalItem
                    item={editingItem}
                    categories={assignableCategories}
                    suggestions={suggestions}
                    onClose={() => { setEditingItem(null); setShowManualAdd(false); }}
                    onSave={handleSaveItem}
                    onScan={() => setIsScanning(true)}
                    onDelete={(id) => { handleDeleteItem(id); setEditingItem(null); }}
                />
            )}
            {showImport && <ModalImport onSave={handleImport} onClose={() => setShowImport(false)} />}
            {pendingLinkImport && (
                <ModalLinkImport
                    count={pendingLinkImport.count}
                    onReplace={() => applyLinkImport('replace')}
                    onMerge={() => applyLinkImport('merge')}
                    onCancel={() => { setPendingLinkImport(null); cleanImportQueryParam(); }}
                />
            )}
            {showCategoryManager && (
                <ModalCategoryManager
                    categories={categories}
                    onClose={() => setShowCategoryManager(false)}
                    onAdd={handleAddCategory}
                    onUpdate={handleUpdateCategory}
                    onDelete={handleDeleteCategory}
                />
            )}
            {showLoyaltyCards && (
                <ModalLoyaltyCards
                    cards={loyaltyCards}
                    onClose={() => setShowLoyaltyCards(false)}
                    onChangeCards={setLoyaltyCards}
                    onToast={showToast}
                />
            )}
            {showTargetEdit && <ModalTarget value={targetAmount} onSave={(v) => { setTargetAmount(v); setShowTargetEdit(false); }} onClose={() => setShowTargetEdit(false)} />}
            {isScanning && <Scanner videoRef={videoRef} canvasRef={canvasRef} status={ocrStatus} progress={ocrProgress} processing={processing} onCapture={captureOCR} onClose={() => setIsScanning(false)} />}
            <Toast toast={toast} onClose={closeToast} />
        </div>
    );
}

SmartCart.App = App;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

})();
