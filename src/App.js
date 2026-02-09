(() => {

const { useState, useEffect, useRef, useMemo } = SmartCart.hooks;
const { Icons, vibrate, Components } = SmartCart;
const { ProgressBar, FilterBar, ItemCard, ModalImport, ModalItem, ModalTarget, Scanner } = Components;

const STORAGE_KEY_ITEMS = 'smartcart_items';
const STORAGE_KEY_TARGET = 'smartcart_target';

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

function App() {
    const [items, setItems] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEY_ITEMS)) || []);
    const [targetAmount, setTargetAmount] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEY_TARGET)) || 20.00);
    const [activeTab, setActiveTab] = useState('cart');
    const [activeCategory, setActiveCategory] = useState('all');

    const [isScanning, setIsScanning] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showTargetEdit, setShowTargetEdit] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [ocrStatus, setOcrStatus] = useState('');
    const [ocrProgress, setOcrProgress] = useState(0);
    const [processing, setProcessing] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
        localStorage.setItem(STORAGE_KEY_TARGET, String(targetAmount));
    }, [items, targetAmount]);

    useEffect(() => {
        let streamObj = null;
        if (isScanning) {
            const initCam = async () => {
                try {
                    setOcrStatus('Apertura fotocamera...');
                    const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
                    streamObj = await navigator.mediaDevices.getUserMedia(constraints);
                    if (videoRef.current) {
                        videoRef.current.srcObject = streamObj;
                        await videoRef.current.play();
                    }
                    setOcrStatus('Inquadra prezzo e nome');
                } catch (e) {
                    try {
                        streamObj = await navigator.mediaDevices.getUserMedia({ video: true });
                        if (videoRef.current) {
                            videoRef.current.srcObject = streamObj;
                            await videoRef.current.play();
                        }
                        setOcrStatus('Inquadra prezzo e nome');
                    } catch (e2) {
                        alert('Errore fotocamera: verifica i permessi del browser.');
                        setIsScanning(false);
                    }
                }
            };
            initCam();
        }
        return () => {
            if (streamObj) streamObj.getTracks().forEach((t) => t.stop());
        };
    }, [isScanning]);

    const categories = useMemo(
        () => [...new Set(items.map((i) => i.category || 'Altro'))].sort((a, b) => a.localeCompare(b)),
        [items]
    );

    const filteredItems = useMemo(
        () => (activeCategory === 'all' ? items : items.filter((i) => (i.category || 'Altro') === activeCategory)),
        [items, activeCategory]
    );

    const cartItems = useMemo(() => filteredItems.filter((i) => i.price > 0), [filteredItems]);
    const todoItems = useMemo(() => filteredItems.filter((i) => !i.price || i.price === 0), [filteredItems]);
    const total = useMemo(
        () => items.filter((i) => i.price > 0).reduce((acc, i) => acc + (i.price * (1 - (i.discount || 0) / 100)), 0),
        [items]
    );

    const handleDeleteItem = (id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        vibrate(10);
    };

    const toggleChecked = (id) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
        vibrate(5);
    };

    const handleSaveItem = (data) => {
        const prepared = {
            ...data,
            name: (data.name || '').trim() || 'Nuovo prodotto',
            category: data.category || 'Altro',
            price: normalizePrice(data.price),
            discount: Number(data.discount) || 0
        };

        if (prepared.isNew) {
            setItems((prev) => [{ ...prepared, id: Date.now(), checked: false }, ...prev]);
            vibrate(10);
        } else {
            setItems((prev) => prev.map((i) => (i.id === prepared.id ? { ...i, ...prepared } : i)));
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

        setItems((prev) => [
            ...cleaned.map((n) => ({ id: Math.random() + Date.now(), name: n, category: 'Altro', price: 0, discount: 0, checked: false })),
            ...prev
        ]);
        setShowImport(false);
        setActiveTab('todo');
        vibrate(30);
    };

    const exportCsv = () => {
        const rows = [
            ['nome', 'categoria', 'prezzo', 'sconto', 'prezzo_finale', 'checked'],
            ...items.map((i) => [
                i.name,
                i.category || 'Altro',
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
                    if (typeof progress === 'number') {
                        setOcrProgress(15 + progress * 70);
                    }
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
                category: prev?.category || 'Altro',
                detectedLines: cleanLines,
                ocrFallback: !suggestedName && !suggestedPrice
            }));

            setOcrProgress(100);
            setIsScanning(false);
            setShowManualAdd(true);

            if (!suggestedName && !suggestedPrice) {
                alert('OCR completato ma non è stato trovato un nome/prezzo affidabile. Inserisci i campi manualmente.');
            }
        } catch (err) {
            alert('Errore OCR: prova con inserimento manuale.');
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
                        <button onClick={exportCsv} title="Esporta CSV" className="p-2 text-gray-400 active:text-blue-600"><Icons.Download size={20} /></button>
                        <button onClick={() => setShowImport(true)} title="Importa" className="p-2 text-gray-400 active:text-blue-600"><Icons.Clipboard size={22} /></button>
                        <button onClick={() => window.confirm('Cancellare tutto?') && setItems([])} title="Svuota" className="p-2 text-gray-400 active:text-red-500"><Icons.Trash size={22} /></button>
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
                <FilterBar categories={categories} value={activeCategory} onChange={setActiveCategory} />

                <main className="space-y-3 mt-1">
                    {(activeTab === 'cart' ? cartItems : todoItems).length === 0 ? (
                        <div className="text-center py-24 opacity-20 flex flex-col items-center">
                            {activeTab === 'cart' ? <Icons.Cart size={64}/> : <Icons.Clipboard size={64}/>}
                            <p className="mt-4 font-bold">Nessun elemento per questo filtro</p>
                        </div>
                    ) : (
                        (activeTab === 'cart' ? cartItems : todoItems).map((i) => (
                            <ItemCard key={i.id} item={i} onEdit={() => setEditingItem(i)} onDelete={handleDeleteItem} onToggleCheck={toggleChecked} />
                        ))
                    )}
                </main>
            </div>

            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto z-30 flex gap-4">
                <button onClick={() => { setEditingItem({ isNew: true, name: '', category: 'Altro', price: 0, discount: 0 }); setShowManualAdd(true); }} className="flex-1 bg-white text-gray-800 py-4 rounded-3xl shadow-xl font-black text-sm uppercase tracking-wider border border-gray-100 active:scale-95 transition-transform">+ Manuale</button>
                <button onClick={() => setIsScanning(true)} className="flex-[1.6] bg-blue-600 text-white py-4 rounded-3xl shadow-xl shadow-blue-200 font-black text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2"><Icons.Camera size={18}/> Scansiona</button>
            </div>

            {(showManualAdd || editingItem) && (
                <ModalItem
                    item={editingItem}
                    categories={categories}
                    onClose={() => { setEditingItem(null); setShowManualAdd(false); }}
                    onSave={handleSaveItem}
                    onScan={() => setIsScanning(true)}
                    onDelete={(id) => { handleDeleteItem(id); setEditingItem(null); }}
                />
            )}
            {showImport && <ModalImport onSave={handleImport} onClose={() => setShowImport(false)} />}
            {showTargetEdit && <ModalTarget value={targetAmount} onSave={(v) => { setTargetAmount(v); setShowTargetEdit(false); }} onClose={() => setShowTargetEdit(false)} />}
            {isScanning && <Scanner videoRef={videoRef} canvasRef={canvasRef} status={ocrStatus} progress={ocrProgress} processing={processing} onCapture={captureOCR} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

SmartCart.App = App;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

})();