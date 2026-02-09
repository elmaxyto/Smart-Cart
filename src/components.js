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
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
    </div>
);

const ItemCard = ({ item, onEdit, onDelete, onToggleCheck }) => {
    const isTodo = !item.price || item.price === 0;
    const timerRef = SmartCart.hooks.useRef(null);
    const [isPressing, setIsPressing] = SmartCart.hooks.useState(false);

    const handleStart = () => {
        setIsPressing(true);
        timerRef.current = setTimeout(() => {
            vibrate(40);
            if(window.confirm(`Vuoi eliminare "${item.name}"?`)) onDelete(item.id);
            setIsPressing(false);
        }, 750);
    };

    const handleEnd = () => {
        clearTimeout(timerRef.current);
        setIsPressing(false);
    };

    return (
        <div
            onMouseDown={handleStart} onMouseUp={handleEnd} onMouseLeave={handleEnd}
            onTouchStart={handleStart} onTouchEnd={handleEnd}
            className={`bg-white p-3 rounded-2xl shadow-sm border ${isTodo ? 'border-dashed border-gray-300' : 'border-gray-50'} flex items-center gap-3 active:bg-gray-50 transition-all ${isPressing ? 'scale-[0.97]' : ''}`}
        >
            {isTodo && (
                <button onClick={(e) => { e.stopPropagation(); onToggleCheck(item.id); vibrate(5); }} className={`shrink-0 transition-colors ${item.checked ? 'text-green-500' : 'text-gray-300'}`}>
                    {item.checked ? <Icons.Check size={24} /> : <Icons.Circle size={24} />}
                </button>
            )}

            <div onClick={onEdit} className="flex-1 min-w-0 py-1">
                <h3 className={`font-bold truncate text-sm ${item.checked ? 'text-gray-300 line-through' : (isTodo ? 'text-gray-500 italic' : 'text-gray-800')}`}>{item.name}</h3>
                <div className="flex gap-2 mt-1">
                    {!!item.category && <span className="inline-block bg-blue-50 text-blue-600 text-[9px] px-2 py-0.5 rounded-full font-black">{item.category}</span>}
                    {item.discount > 0 && <span className="inline-block bg-red-100 text-red-600 text-[9px] px-2 py-0.5 rounded-full font-black">-{item.discount}%</span>}
                </div>
            </div>

            <div onClick={onEdit} className="text-right font-black text-base text-gray-900 shrink-0 pl-2">
                {isTodo ? <span className="text-blue-500 text-[10px] flex items-center gap-1 font-bold uppercase">Prezzo <Icons.Euro size={10}/></span> : `€ ${(item.price * (1 - (item.discount || 0)/100)).toFixed(2)}`}
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

const ModalItem = ({ item, categories, onClose, onSave, onDelete, onScan }) => {
    const [name, setName] = SmartCart.hooks.useState(item?.name || '');
    const [price, setPrice] = SmartCart.hooks.useState(item?.price || '');
    const [discount, setDiscount] = SmartCart.hooks.useState(item?.discount || 0);
    const [category, setCategory] = SmartCart.hooks.useState(item?.category || 'Altro');

    SmartCart.hooks.useEffect(() => {
        setName(item?.name || '');
        setPrice(item?.price || '');
        setDiscount(item?.discount || 0);
        setCategory(item?.category || 'Altro');
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
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="..." className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"/>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Categoria</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl outline-none text-sm font-bold">
                            {[...new Set(['Altro', ...categories])].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
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

                    <button onClick={() => onSave({ ...item, name, category, price: parseFloat(price) || 0, discount })} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-transform">Salva</button>
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

SmartCart.Components = {
    ProgressBar,
    FilterBar,
    ItemCard,
    ModalImport,
    ModalItem,
    ModalTarget,
    Scanner
};

window.SmartCart = SmartCart;