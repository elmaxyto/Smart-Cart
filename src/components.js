(function () {
const { Icons, vibrate } = SmartCart;

const ProgressBar = ({ total, target, onEditTarget }) => {
    const remaining = Math.max(0, target - total);
    const progress = target > 0 ? Math.min(100, (total / target) * 100) : 0;
    const isOverBudget = total > target;

    return (
        <div className={`bg-white p-4 rounded-2xl shadow-sm mb-4 border ${isOverBudget ? 'border-red-200' : 'border-gray-100'}`}>
            <div className="flex justify-between items-end mb-2">
                <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Spesa nel carrello</p>
                    <p className="text-3xl font-black text-gray-900">€ {total.toFixed(2)}</p>
                </div>
                <button className="text-right cursor-pointer" onClick={onEditTarget}>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center justify-end gap-1">Soglia <Icons.Edit size={10}/></p>
                    <p className="text-xl font-bold text-blue-600">€ {target.toFixed(2)}</p>
                </button>
            </div>
            <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className={`absolute h-full transition-all duration-700 ease-out ${remaining === 0 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
            </div>
            <div className="mt-3 text-xs font-bold text-center">
                {isOverBudget ? (
                    <span className="text-red-600">Hai superato la soglia di <span className="text-sm">€ {(total - target).toFixed(2)}</span></span>
                ) : remaining > 0 ? (
                    <span className="text-red-500">Mancano <span className="text-sm">€ {remaining.toFixed(2)}</span> alla soglia spesa</span>
                ) : (
                    <span className="text-green-600 flex items-center justify-center gap-1"><Icons.Check size={14}/> Soglia raggiunta</span>
                )}
            </div>
        </div>
    );
};

const FilterBar = ({ categories, value, onChange }) => (
    <div className="mb-3 flex items-center gap-2">
        <div className="text-gray-400"><Icons.Tag size={16} /></div>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Tutte le categorie</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
    </div>
);

const ItemCard = ({ item, category, categories, onEdit, onDelete, onToggleCheck, onCategoryChange }) => {
    const isTodo = !item.price || item.price === 0;
    const ACTION_WIDTH = 92;
    const [offsetX, setOffsetX] = SmartCart.hooks.useState(0);
    const [isDragging, setIsDragging] = SmartCart.hooks.useState(false);
    const startXRef = SmartCart.hooks.useRef(0);
    const startYRef = SmartCart.hooks.useRef(0);
    const startOffsetRef = SmartCart.hooks.useRef(0);
    const isSwipingRef = SmartCart.hooks.useRef(false);
    const didSwipeRef = SmartCart.hooks.useRef(false);

    const clampOffset = (value) => Math.max(-ACTION_WIDTH, Math.min(0, value));

    const beginSwipe = (x, y) => {
        startXRef.current = x;
        startYRef.current = y;
        startOffsetRef.current = offsetX;
        isSwipingRef.current = false;
        didSwipeRef.current = false;
    };

    const updateSwipe = (x, y, event) => {
        const dx = x - startXRef.current;
        const dy = y - startYRef.current;

        if (!isSwipingRef.current) {
            if (Math.abs(dx) < 8) return;
            if (Math.abs(dy) > Math.abs(dx)) return;
            isSwipingRef.current = true;
            setIsDragging(true);
        }

        didSwipeRef.current = true;
        const nextOffset = clampOffset(startOffsetRef.current + dx);
        setOffsetX(nextOffset);

        if (event?.cancelable) event.preventDefault();
    };

    const endSwipe = () => {
        if (!isSwipingRef.current) return;
        setIsDragging(false);
        setOffsetX((prev) => (prev < -ACTION_WIDTH * 0.45 ? -ACTION_WIDTH : 0));
        isSwipingRef.current = false;
    };

    const handleCardClick = () => {
        if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
        }
        if (offsetX < 0) {
            setOffsetX(0);
            return;
        }
        onEdit();
    };

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <button
                onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}
                className="absolute right-0 top-0 bottom-0 w-[92px] bg-red-500 text-white flex items-center justify-center gap-1 font-black text-[10px] uppercase tracking-wider"
                aria-label={`Cancella ${item.name}`}
            >
                <Icons.Trash size={14} />
                Cancella
            </button>

            <div
                onMouseDown={(e) => beginSwipe(e.clientX, e.clientY)}
                onMouseMove={(e) => { if (e.buttons === 1) updateSwipe(e.clientX, e.clientY, e); }}
                onMouseUp={endSwipe}
                onMouseLeave={endSwipe}
                onTouchStart={(e) => { const t = e.touches[0]; if (t) beginSwipe(t.clientX, t.clientY); }}
                onTouchMove={(e) => { const t = e.touches[0]; if (t) updateSwipe(t.clientX, t.clientY, e); }}
                onTouchEnd={endSwipe}
                onTouchCancel={endSwipe}
                onClick={handleCardClick}
                className={`bg-white p-3 rounded-2xl shadow-sm border ${isTodo ? 'border-dashed border-gray-300' : 'border-gray-50'} flex items-center gap-3 active:bg-gray-50 transition-all ${isDragging ? 'scale-[0.99]' : ''}`}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 180ms ease-out',
                    touchAction: 'pan-y'
                }}
            >
                {isTodo && (
                    <button onClick={(e) => { e.stopPropagation(); onToggleCheck(item.id); vibrate(5); }} className={`shrink-0 transition-colors ${item.checked ? 'text-green-500' : 'text-gray-300'}`}>
                        {item.checked ? <Icons.Check size={24} /> : <Icons.Circle size={24} />}
                    </button>
                )}

                <div className="flex-1 min-w-0 py-1">
                    <h3 className={`font-bold truncate text-sm ${item.checked ? 'text-gray-300 line-through' : (isTodo ? 'text-gray-500 italic' : 'text-gray-800')}`}>{item.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1 items-center">
                        {!!category?.name && (
                            <span className="inline-block text-[9px] px-2 py-0.5 rounded-full font-black" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
                                {category.name}
                            </span>
                        )}

                        <select
                            aria-label={`Categoria per ${item.name}`}
                            value={item.categoryId || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onCategoryChange(item.id, e.target.value)}
                            className="max-w-[8.5rem] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-600 outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">Altro</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>

                        {item.discount > 0 && <span className="inline-block bg-red-100 text-red-600 text-[9px] px-2 py-0.5 rounded-full font-black">-{item.discount}%</span>}
                    </div>
                </div>

                <div className="text-right font-black text-base text-gray-900 shrink-0 pl-2">
                    {isTodo ? <span className="text-blue-500 text-[10px] flex items-center gap-1 font-bold uppercase">Prezzo <Icons.Euro size={10}/></span> : `€ ${(item.price * (1 - (item.discount || 0)/100)).toFixed(2)}`}
                </div>
            </div>
        </div>
    );
};

const ModalImport = ({ onSave, onClose }) => {
    const [text, setText] = SmartCart.hooks.useState('');
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                <h3 className="font-black text-xl mb-2 text-gray-900 uppercase tracking-tight">Importa lista</h3>
                <p className="text-xs text-gray-400 mb-4 font-bold">Incolla testo con virgole o ritorni a capo.</p>
                <textarea autoFocus className="w-full h-40 p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm font-medium resize-none" placeholder="Mela, Pera, Latte..." value={text} onChange={e => setText(e.target.value)}></textarea>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 font-bold text-gray-400 bg-gray-100 rounded-2xl uppercase text-[10px]">Annulla</button>
                    <button onClick={() => onSave(text)} disabled={!text.trim()} className="flex-[1.5] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] disabled:opacity-50">Crea lista</button>
                </div>
            </div>
        </div>
    );
};

const SuggestionsInput = ({ value, onChange, suggestions, onPick, placeholder = '...' }) => {
    const normalized = String(value || '').trim().toLowerCase();
    const filtered = normalized.length < 2
        ? []
        : suggestions
            .filter((entry) => entry.toLowerCase().includes(normalized))
            .slice(0, 6);

    return (
        <div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
            />
            {filtered.length > 0 && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-2 grid gap-1">
                    {filtered.map((entry) => (
                        <button
                            key={entry}
                            onClick={() => onPick(entry)}
                            className="text-left px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-100"
                        >
                            {entry}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ModalLinkImport = ({ count, onReplace, onMerge, onCancel }) => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
            <h3 className="font-black text-xl mb-2 text-gray-900 uppercase tracking-tight">Import da link</h3>
            <p className="text-sm text-gray-600 font-bold leading-relaxed">
                Trovata una lista SmartCart nel link.
                <br />
                Vuoi importare <span className="text-blue-600">{count} elementi</span> nella tua lista locale?
            </p>
            <div className="grid gap-2 mt-5">
                <button onClick={onReplace} className="w-full py-3 font-black text-gray-800 bg-gray-100 rounded-2xl uppercase text-[10px] tracking-wider">
                    Sostituisci lista corrente
                </button>
                <button onClick={onMerge} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider">
                    Aggiungi alla lista esistente
                </button>
                <button onClick={onCancel} className="w-full py-2 font-bold text-gray-500 uppercase text-[10px] mt-1">
                    Annulla
                </button>
            </div>
        </div>
    </div>
);

const ModalItem = ({ item, categories, suggestions, onClose, onSave, onDelete, onScan }) => {
    const [name, setName] = SmartCart.hooks.useState(item?.name || '');
    const [price, setPrice] = SmartCart.hooks.useState(item?.price || '');
    const [discount, setDiscount] = SmartCart.hooks.useState(item?.discount || 0);
    const [categoryId, setCategoryId] = SmartCart.hooks.useState(item?.categoryId || '');

    SmartCart.hooks.useEffect(() => {
        setName(item?.name || '');
        setPrice(item?.price || '');
        setDiscount(item?.discount || 0);
        setCategoryId(item?.categoryId || '');
    }, [item]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl my-0 sm:my-4">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{item?.isNew ? 'Nuovo' : 'Modifica'}</h3>
                    <div className="flex gap-2">
                        <button onClick={onScan} className="text-blue-600 bg-blue-50 p-3 rounded-2xl"><Icons.Camera size={18}/></button>
                        {!item?.isNew && <button onClick={() => onDelete(item.id)} className="text-red-500 bg-red-50 p-3 rounded-2xl"><Icons.Trash size={18}/></button>}
                        <button onClick={onClose} className="text-gray-400 p-3"><Icons.X size={18}/></button>
                    </div>
                </div>

                {item?.detectedLines?.length > 0 && (
                    <div className="mb-6">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-2">Testo rilevato</p>
                        <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {item.detectedLines.map((l, i) => (
                                <div key={i} className="flex gap-2">
                                    <button onClick={() => setName(l)} className="flex-1 text-[10px] p-3 bg-gray-50 rounded-xl text-left truncate font-bold text-gray-600">{l}</button>
                                    <button onClick={() => setPrice(l.replace(/[^0-9.,]/g, '').replace(',', '.'))} className="p-3 bg-blue-600 text-white rounded-xl shadow-sm"><Icons.Euro size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Prodotto</label>
                        <SuggestionsInput
                            value={name}
                            onChange={setName}
                            onPick={setName}
                            suggestions={Array.isArray(suggestions) ? suggestions : []}
                            placeholder="..."
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Categoria</label>
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl outline-none text-sm font-bold">
                            <option value="">Altro</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Prezzo (€)</label>
                            <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-black text-xl"/>
                        </div>
                        <div className="w-24">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Sconto %</label>
                            <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} placeholder="0" className="w-full p-4 bg-red-50 rounded-2xl outline-none text-red-600 font-black text-xl text-center"/>
                        </div>
                    </div>

                    <button onClick={() => onSave({ ...item, name, categoryId, price: parseFloat(price) || 0, discount })} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-transform">Salva</button>
                </div>
            </div>
        </div>
    );
};

const ModalCategoryManager = ({ categories, onClose, onAdd, onUpdate, onDelete }) => {
    const [name, setName] = SmartCart.hooks.useState('');
    const [color, setColor] = SmartCart.hooks.useState('#64748b');
    const [drafts, setDrafts] = SmartCart.hooks.useState({});
    const editable = categories.filter((cat) => cat.id !== 'uncategorized');

    SmartCart.hooks.useEffect(() => {
        const nextDrafts = {};
        editable.forEach((cat) => {
            nextDrafts[cat.id] = cat.name;
        });
        setDrafts(nextDrafts);
    }, [categories.length]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-xl text-gray-900 uppercase tracking-tight">Gestisci categorie</h3>
                    <button onClick={onClose} className="text-gray-400"><Icons.X size={18} /></button>
                </div>

                <div className="space-y-2 mb-5">
                    {editable.length === 0 && <p className="text-xs font-bold text-gray-500">Nessuna categoria personalizzata.</p>}
                    {editable.map((cat) => (
                        <div key={cat.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2">
                                <input
                                    value={drafts[cat.id] ?? cat.name}
                                    onChange={(e) => setDrafts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                                    onBlur={() => onUpdate(cat.id, { name: drafts[cat.id] ?? cat.name })}
                                    className="flex-1 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs font-bold"
                                />
                                <input type="color" value={cat.color} onChange={(e) => onUpdate(cat.id, { color: e.target.value })} className="w-10 h-10 rounded-lg border border-gray-200" />
                                <button onClick={() => onDelete(cat.id)} className="p-2 text-red-500"><Icons.Trash size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-2">Nuova categoria</p>
                    <div className="flex gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Frutta" className="flex-1 px-3 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold" />
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-12 rounded-xl border border-gray-200" />
                    </div>
                    <button
                        onClick={() => {
                            onAdd({ name, color });
                            setName('');
                            setColor('#64748b');
                        }}
                        disabled={!name.trim()}
                        className="w-full mt-3 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-40"
                    >
                        Aggiungi categoria
                    </button>
                </div>
            </div>
        </div>
    );
};

const BarcodePreview = ({ value }) => {
    const safe = String(value || '').trim();
    const bars = safe.split('').map((ch, index) => {
        const code = ch.charCodeAt(0);
        return `${(code % 4) + 1}${index % 2}`;
    }).join('');

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="h-14 flex items-end gap-[1px] overflow-hidden rounded bg-gray-50 p-1">
                {bars.split('').map((digit, idx) => (
                    <span key={`${digit}-${idx}`} style={{ width: '2px', height: `${25 + Number(digit) * 8}px` }} className="bg-gray-900 inline-block" />
                ))}
            </div>
            <p className="mt-2 text-center text-[11px] font-black tracking-wider text-gray-600">{safe}</p>
        </div>
    );
};

const ModalLoyaltyCards = ({ cards, onClose, onChangeCards, onToast }) => {
    const [name, setName] = SmartCart.hooks.useState('');
    const [code, setCode] = SmartCart.hooks.useState('');
    const [type, setType] = SmartCart.hooks.useState('barcode');
    const [scanning, setScanning] = SmartCart.hooks.useState(false);
    const [scanError, setScanError] = SmartCart.hooks.useState('');
    const videoRef = SmartCart.hooks.useRef(null);
    const streamRef = SmartCart.hooks.useRef(null);
    const frameRef = SmartCart.hooks.useRef(null);
    const scanningRef = SmartCart.hooks.useRef(false);

    const stopScanner = SmartCart.hooks.useCallback(() => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setScanning(false);
    }, []);

    SmartCart.hooks.useEffect(() => () => stopScanner(), [stopScanner]);

    const startScanner = async () => {
        setScanError('');
        if (!(window.BarcodeDetector && navigator.mediaDevices?.getUserMedia)) {
            setScanError('Scanner non supportato su questo browser. Inserisci il codice manualmente.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
            streamRef.current = stream;
            setScanning(true);
            scanningRef.current = true;
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            await video.play();

            const detector = new window.BarcodeDetector();
            const scanLoop = async () => {
                if (!videoRef.current || !scanningRef.current) return;
                try {
                    const detections = await detector.detect(videoRef.current);
                    if (detections?.length) {
                        const first = detections[0];
                        setCode(first.rawValue || '');
                        if (first.format?.toLowerCase().includes('qr')) setType('qr');
                        onToast?.({ type: 'success', message: 'Codice rilevato con successo' });
                        stopScanner();
                        return;
                    }
                } catch (e) {
                    setScanError('Errore durante la scansione.');
                    stopScanner();
                    return;
                }
                frameRef.current = requestAnimationFrame(scanLoop);
            };
            frameRef.current = requestAnimationFrame(scanLoop);
        } catch (error) {
            setScanError('Impossibile accedere alla fotocamera.');
            stopScanner();
        }
    };

    const addCard = () => {
        const trimmedName = name.trim();
        const trimmedCode = code.trim();
        if (!trimmedName || !trimmedCode) return;
        onChangeCards((prev) => ([
            {
                id: `${Date.now()}-${Math.random()}`,
                name: trimmedName,
                code: trimmedCode,
                type,
                createdAt: Date.now()
            },
            ...prev
        ]));
        setName('');
        setCode('');
        setType('barcode');
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-xl text-gray-900 uppercase tracking-tight">Carte fedeltà</h3>
                    <button onClick={() => { stopScanner(); onClose(); }} className="text-gray-400"><Icons.X size={18} /></button>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2 mb-5">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome carta" className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold" />
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice" className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold" />
                    <div className="flex gap-2">
                        <select value={type} onChange={(e) => setType(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-bold">
                            <option value="barcode">Barcode</option>
                            <option value="qr">QR Code</option>
                        </select>
                        <button onClick={startScanner} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase">Scansiona</button>
                    </div>
                    {scanError && <p className="text-[11px] text-red-500 font-bold">{scanError}</p>}
                    {scanning && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-black">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-44 object-cover" />
                            <button onClick={stopScanner} className="w-full py-2 text-xs font-black uppercase bg-gray-100 text-gray-700">Ferma scanner</button>
                        </div>
                    )}
                    <button onClick={addCard} disabled={!name.trim() || !code.trim()} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase disabled:opacity-40">
                        Salva carta
                    </button>
                </div>

                <div className="space-y-3">
                    {cards.length === 0 && <p className="text-xs text-gray-500 font-bold">Nessuna carta salvata.</p>}
                    {cards.map((card) => (
                        <div key={card.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                            <div className="flex justify-between items-center gap-2">
                                <div>
                                    <p className="text-sm font-black text-gray-800">{card.name}</p>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">{card.type === 'qr' ? 'QR Code' : 'Barcode'}</p>
                                </div>
                                <button onClick={() => onChangeCards((prev) => prev.filter((c) => c.id !== card.id))} className="text-red-500 p-2"><Icons.Trash size={15}/></button>
                            </div>
                            <BarcodePreview value={card.code} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ModalTarget = ({ value, onSave, onClose }) => {
    const [val, setVal] = SmartCart.hooks.useState(value);
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-lg">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl">
                <h3 className="font-black text-center text-xl mb-6 text-gray-900 uppercase tracking-tight">Soglia spesa</h3>
                <div className="relative mb-8">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-black text-2xl">€</span>
                    <input type="number" value={val} onChange={e => setVal(parseFloat(e.target.value) || 0)} className="w-full p-6 pl-12 text-center text-4xl font-black bg-blue-50 border-0 rounded-[2rem] outline-none text-blue-600" />
                </div>
                <button onClick={() => onSave(val)} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform">Conferma</button>
                <button onClick={onClose} className="w-full mt-4 py-2 text-gray-400 font-bold uppercase text-[10px]">Chiudi</button>
            </div>
        </div>
    );
};

const Scanner = ({ videoRef, canvasRef, status, progress, processing, onCapture, onClose }) => (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="relative flex-1">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 scan-overlay flex items-center justify-center">
                <div className="w-72 h-48 border-2 border-white/30 rounded-[2.5rem] relative overflow-hidden">
                    <div className="scan-line"></div>
                </div>
            </div>
            <button onClick={onClose} className="absolute top-10 right-6 p-4 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-90 transition-transform"><Icons.X size={24}/></button>
        </div>
        <div className="bg-white p-8 rounded-t-[3rem] -mt-10 z-10 text-center shadow-2xl">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">{status || "Inquadra prezzo e nome"}</p>
            {processing && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(5, progress)}%` }}></div>
                </div>
            )}
            <button onClick={onCapture} disabled={processing} className={`w-full py-5 rounded-[2rem] font-black text-lg uppercase tracking-widest text-white shadow-2xl transition-all active:scale-95 ${processing ? 'bg-gray-300' : 'bg-blue-600 shadow-blue-200'}`}>
                {processing ? `Analisi ${Math.round(progress)}%` : 'Cattura'}
            </button>
        </div>
    </div>
);

const Toast = ({ toast, onClose }) => {
    if (!toast) return null;

    const toneClasses = {
        success: 'border-green-500 text-green-600',
        error: 'border-red-500 text-red-600',
        info: 'border-blue-500 text-blue-600'
    };

    const tone = toneClasses[toast.type] || toneClasses.info;

    return (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 w-[calc(100%-2rem)] max-w-md">
            <div className="bg-white rounded-2xl shadow-lg border px-4 py-3 flex items-center gap-3" role="status" aria-live="polite">
                <div className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${tone}`}>
                    {toast.type === 'success' ? 'OK' : toast.type === 'error' ? 'Errore' : 'Info'}
                </div>
                <p className="flex-1 text-xs font-bold text-gray-700">{toast.message}</p>
                {toast.actionLabel && typeof toast.onAction === 'function' && (
                    <button onClick={toast.onAction} className="text-[10px] font-black uppercase tracking-wider text-blue-600">{toast.actionLabel}</button>
                )}
                <button onClick={onClose} className="text-gray-400" aria-label="Chiudi notifica"><Icons.X size={16} /></button>
            </div>
        </div>
    );
};

SmartCart.Components = {
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
};

window.SmartCart = SmartCart;
})();
