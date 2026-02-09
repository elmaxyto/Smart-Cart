// Dipendenze da React e utils.js, components.js (assumendo che siano caricate globalmente)
// const { useState, useEffect, useRef, useMemo } = React; // Da utils.js
// const { Icons, vibrate } = window; // Da utils.js
// const { ProgressBar, ItemCard, ModalImport, ModalItem, ModalTarget, Scanner } = window; // Da components.js

// --- 4. MAIN APP LOGIC ---
function App() {
    const [items, setItems] = useState(() => JSON.parse(localStorage.getItem('smartcart_items')) || []);
    const [targetAmount, setTargetAmount] = useState(() => parseFloat(localStorage.getItem('smartcart_target')) || 20.00);
    const [activeTab, setActiveTab] = useState('cart'); 
    
    const [isScanning, setIsScanning] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showTargetEdit, setShowTargetEdit] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    const [ocrStatus, setOcrStatus] = useState('');
    const [processing, setProcessing] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('smartcart_items', JSON.stringify(items));
        localStorage.setItem('smartcart_target', targetAmount);
    }, [items, targetAmount]);

    useEffect(() => {
        let streamObj = null;
        if (isScanning) {
            const initCam = async () => {
                try {
                    const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
                    streamObj = await navigator.mediaDevices.getUserMedia(constraints);
                    if (videoRef.current) {
                        videoRef.current.srcObject = streamObj;
                        await videoRef.current.play();
                    }
                } catch (e) {
                    try {
                        streamObj = await navigator.mediaDevices.getUserMedia({ video: true });
                        if (videoRef.current) {
                            videoRef.current.srcObject = streamObj;
                            await videoRef.current.play();
                        }
                    } catch (e2) {
                        alert("Errore fotocamera: Verifica i permessi browser.");
                        setIsScanning(false);
                    }
                }
            };
            initCam();
        }
        return () => {
            if (streamObj) streamObj.getTracks().forEach(t => t.stop());
        };
    }, [isScanning]);

    const cartItems = useMemo(() => items.filter(i => i.price > 0), [items]);
    const todoItems = useMemo(() => items.filter(i => !i.price || i.price === 0), [items]);
    const total = useMemo(() => cartItems.reduce((acc, i) => acc + (i.price * (1 - (i.discount || 0)/100)), 0), [cartItems]);

    const handleDeleteItem = (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
        vibrate(10);
    };

    const toggleChecked = (id) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
        vibrate(5);
    };

    const handleSaveItem = (data) => {
        if (data.isNew) {
            setItems(prev => [{ ...data, id: Date.now(), checked: false }, ...prev]);
            vibrate(10);
        } else {
            setItems(prev => prev.map(i => i.id === data.id ? { ...data, checked: false } : i));
        }
        setEditingItem(null); setShowManualAdd(false); setIsScanning(false);
    };

    const handleImport = (text) => {
        const fragments = text.split(/[\n,;]/);
        const cleaned = [...new Set(fragments.map(f => {
            let c = f.trim();
            c = c.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
            c = c.replace(/^[\d\s.•\-\*)]+/, '');
            c = c.replace(/^(\d+\s*[xX]?\s*)/, '');
            return c.trim();
        }).filter(n => n.length > 1))];
        
        setItems(prev => [...cleaned.map(n => ({ id: Math.random() + Date.now(), name: n, price: 0, discount: 0, checked: false })), ...prev]);
        setShowImport(false); setActiveTab('todo'); vibrate(30);
    };

    const captureOCR = async () => {
        if (!videoRef.current) return;
        vibrate(); setProcessing(true); setOcrStatus('Analisi immagine...');
        
        try {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

            // Tesseract v4 initialization
            // Tesseract è una variabile globale caricata tramite CDN in index2.html
            const { data: { text } } = await Tesseract.recognize(canvas, 'ita');
            
            const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
            const prices = text.match(/(\d+[.,]\d{2})/g) || [];
            
            setEditingItem(prev => ({ 
                ...(prev || {}),
                isNew: !prev?.id,
                name: prev?.name || rawLines[0] || '', 
                price: prices[0]?.replace(',','.') || '', 
                detectedLines: [...new Set(rawLines)] 
            }));
            setIsScanning(false); setShowManualAdd(true);
        } catch (err) {
            alert("Errore OCR: Prova inserimento manuale.");
            console.error(err);
        } finally {
            setProcessing(false);
            setOcrStatus('');
        }
    };

    return (
        <div className="max-w-md mx-auto min-h-screen pb-24 relative overflow-hidden flex flex-col bg-gray-50">
            <header className="bg-white p-4 pt-6 pb-0 sticky top-0 z-20 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Icons.Cart size={20} /></div> SmartCart
                    </h1>
                    <div className="flex gap-1">
                        <button onClick={() => setShowImport(true)} className="p-2 text-gray-400 active:text-blue-600"><Icons.Clipboard size={22} /></button>
                        <button onClick={() => window.confirm("Cancellare tutto?") && setItems([])} className="p-2 text-gray-400 active:text-red-500"><Icons.Trash size={22} /></button>
                    </div>
                </div>

                <div className="flex">
                    <button onClick={() => setActiveTab('cart')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === 'cart' ? 'tab-active' : 'text-gray-400'}`}>
                        Carrello ({cartItems.length})
                    </button>
                    <button onClick={() => setActiveTab('todo')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === 'todo' ? 'tab-active' : 'text-gray-400'}`}>
                        Lista Spesa ({todoItems.length})
                    </button>
                </div>
            </header>

            <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'cart' && <ProgressBar total={total} target={targetAmount} onEditTarget={() => setShowTargetEdit(true)} />}

                <main className="space-y-3 mt-1">
                    {(activeTab === 'cart' ? cartItems : todoItems).length === 0 ? (
                        <div className="text-center py-24 opacity-10 flex flex-col items-center">
                            {activeTab === 'cart' ? <Icons.Cart size={64}/> : <Icons.Clipboard size={64}/>}
                            <p className="mt-4 font-bold">Tutto vuoto qui</p>
                        </div>
                    ) : (
                        (activeTab === 'cart' ? cartItems : todoItems).map(i => (
                            <ItemCard key={i.id} item={i} onEdit={() => setEditingItem(i)} onDelete={handleDeleteItem} onToggleCheck={toggleChecked} />
                        ))
                    )}
                </main>
            </div>

            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto z-30 flex gap-4">
                <button onClick={() => { setEditingItem({isNew:true, name:'', price:0, discount:0}); setShowManualAdd(true); }} className="flex-1 bg-white text-gray-800 py-4 rounded-3xl shadow-xl font-black text-sm uppercase tracking-wider border border-gray-100 active:scale-95 transition-transform">+ Manuale</button>
                <button onClick={() => setIsScanning(true)} className="flex-[1.6] bg-blue-600 text-white py-4 rounded-3xl shadow-xl shadow-blue-200 font-black text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2"> <Icons.Camera size={18}/> Scansiona</button>
            </div>

            {(showManualAdd || editingItem) && (
                <ModalItem 
                    item={editingItem} 
                    onClose={() => { setEditingItem(null); setShowManualAdd(false); }} 
                    onSave={handleSaveItem}
                    onScan={() => setIsScanning(true)}
                    onDelete={(id) => { handleDeleteItem(id); setEditingItem(null); }}
                />
            )}
            {showImport && <ModalImport onSave={handleImport} onClose={() => setShowImport(false)} />}
            {showTargetEdit && <ModalTarget value={targetAmount} onSave={(v) => { setTargetAmount(v); setShowTargetEdit(false); }} onClose={() => setShowTargetEdit(false)} />}
            {isScanning && <Scanner videoRef={videoRef} canvasRef={canvasRef} status={ocrStatus} processing={processing} onCapture={captureOCR} onClose={() => setIsScanning(false)} />}
        </div>
    );
}