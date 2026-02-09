const { useState, useEffect, useRef, useMemo } = React;

// --- 1. UTILS ---
const vibrate = (ms = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
};

// --- 2. COMPONENTS: ICONS ---
const Icon = ({ children, size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);
const Icons = {
    Camera: (p) => <Icon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></Icon>,
    Plus: (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>,
    Trash: (p) => <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></Icon>,
    Edit: (p) => <Icon {...p}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></Icon>,
    Check: (p) => <Icon {...p}><polyline points="20 6 9 17 4 12"/></Icon>,
    Cart: (p) => <Icon {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></Icon>,
    Euro: (p) => <Icon {...p}><path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/></Icon>,
    Clipboard: (p) => <Icon {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></Icon>,
    Circle: (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/></Icon>,
    X: (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>
};

// Esporta per l'uso in altri moduli
// Nota: Stiamo usando un approccio non-module (script type="text/babel") quindi useremo variabili globali
// per semplicità, ma le esporteremo comunque per chiarezza concettuale.
// In un ambiente moderno (es. Webpack/Vite), useremmo 'export'. Qui ci affidiamo all'ordine di caricamento.

// Per ora, definiamo solo le variabili globali come erano in index.html
// e le useremo in src/components.js e src/App.js.

// Se volessimo usare i moduli ES6 (import/export), dovremmo cambiare lo script type in index2.html
// e usare un bundler, ma per mantenere la semplicità del setup iniziale (solo CDN e Babel Standalone),
// manterremo la struttura di variabili globali.

// Per coerenza, useremo 'var' o 'const' globali.
