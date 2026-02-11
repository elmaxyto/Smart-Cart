(function () {
const SmartCart = window.SmartCart || {};

const STORAGE_KEY_CATEGORIES = 'smartcart_categories';
const UNCATEGORIZED_ID = 'uncategorized';

const DEFAULT_CATEGORY = {
    id: UNCATEGORIZED_ID,
    name: 'Altro',
    color: '#2563eb',
    icon: ''
};

const normalizeHexColor = (value) => {
    const fallback = DEFAULT_CATEGORY.color;
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallback;
};

const normalizeCategory = (category) => {
    const id = String(category?.id || '').trim();
    const name = String(category?.name || '').trim();
    if (!id || !name) return null;

    return {
        id,
        name,
        color: normalizeHexColor(category?.color),
        icon: String(category?.icon || '').trim()
    };
};

const normalizeCategories = (input) => {
    const source = Array.isArray(input) ? input : [];
    const seen = new Set();
    const normalized = [];

    source.forEach((cat) => {
        const valid = normalizeCategory(cat);
        if (!valid || seen.has(valid.id)) return;
        seen.add(valid.id);
        normalized.push(valid);
    });

    if (!seen.has(DEFAULT_CATEGORY.id)) {
        normalized.unshift(DEFAULT_CATEGORY);
    }

    return normalized;
};

const loadCategories = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
        return normalizeCategories(raw);
    } catch (e) {
        return normalizeCategories([]);
    }
};

const saveCategories = (categories) => {
    const normalized = normalizeCategories(categories);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(normalized));
    return normalized;
};

const createCategoryFromName = (name, existingCategories = []) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    const existing = existingCategories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;

    const base = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    let id = base || `cat-${Date.now()}`;
    let counter = 1;
    const ids = new Set(existingCategories.map((c) => c.id));
    while (ids.has(id)) {
        id = `${base || 'cat'}-${counter++}`;
    }

    return {
        id,
        name: trimmed,
        color: '#64748b',
        icon: ''
    };
};

const migrateItemsAndCategories = (items, categories) => {
    const sourceItems = Array.isArray(items) ? items : [];
    let nextCategories = normalizeCategories(categories);

    const mappedItems = sourceItems.map((item) => {
        const hasCategoryId = typeof item?.categoryId === 'string' && item.categoryId.trim().length > 0;
        if (hasCategoryId) {
            return { ...item, categoryId: item.categoryId.trim() };
        }

        const legacyName = String(item?.category || '').trim();
        if (!legacyName || legacyName.toLowerCase() === 'altro') {
            return { ...item, categoryId: '' };
        }

        const maybeNew = createCategoryFromName(legacyName, nextCategories);
        if (maybeNew && !nextCategories.some((c) => c.id === maybeNew.id)) {
            nextCategories = [...nextCategories, maybeNew];
        }

        return {
            ...item,
            categoryId: maybeNew?.id || ''
        };
    });

    return {
        items: mappedItems,
        categories: normalizeCategories(nextCategories)
    };
};

const resolveCategoryForItem = (item, categories) => {
    const normalized = normalizeCategories(categories);
    const id = String(item?.categoryId || '').trim();
    if (!id) return DEFAULT_CATEGORY;
    return normalized.find((c) => c.id === id) || DEFAULT_CATEGORY;
};

const getFilterCategories = (categories) => normalizeCategories(categories);

const addCategory = (categories, draft) => {
    const normalized = normalizeCategories(categories);
    const name = String(draft?.name || '').trim();
    if (!name) {
        throw new Error('Nome categoria obbligatorio');
    }

    const duplicate = normalized.find((cat) => cat.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        throw new Error('Esiste già una categoria con questo nome');
    }

    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const ids = new Set(normalized.map((cat) => cat.id));
    let id = base || `cat-${Date.now()}`;
    let counter = 1;
    while (ids.has(id)) {
        id = `${base || 'cat'}-${counter++}`;
    }

    return normalizeCategories([
        ...normalized,
        {
            id,
            name,
            color: normalizeHexColor(draft?.color),
            icon: String(draft?.icon || '').trim()
        }
    ]);
};

const updateCategory = (categories, categoryId, patch) => {
    const normalized = normalizeCategories(categories);
    const id = String(categoryId || '').trim();
    if (!id || id === UNCATEGORIZED_ID) {
        throw new Error('Categoria non modificabile');
    }

    const category = normalized.find((cat) => cat.id === id);
    if (!category) {
        throw new Error('Categoria non trovata');
    }

    const nextName = String(patch?.name ?? category.name).trim();
    if (!nextName) {
        throw new Error('Nome categoria obbligatorio');
    }

    const duplicate = normalized.find((cat) => cat.id !== id && cat.name.toLowerCase() === nextName.toLowerCase());
    if (duplicate) {
        throw new Error('Esiste già una categoria con questo nome');
    }

    return normalizeCategories(normalized.map((cat) => {
        if (cat.id !== id) return cat;
        const patchedIcon = patch?.icon ?? cat.icon;
        return {
            ...cat,
            name: nextName,
            color: normalizeHexColor(patch?.color ?? cat.color),
            icon: String(patchedIcon || '').trim()
        };
    }));
};

const removeCategory = (categories, items, categoryId) => {
    const normalized = normalizeCategories(categories);
    const id = String(categoryId || '').trim();
    if (!id || id === UNCATEGORIZED_ID) {
        throw new Error('Categoria non eliminabile');
    }

    if (!normalized.some((cat) => cat.id === id)) {
        return {
            categories: normalized,
            items: Array.isArray(items) ? items : []
        };
    }

    const nextCategories = normalizeCategories(normalized.filter((cat) => cat.id !== id));
    const nextItems = (Array.isArray(items) ? items : []).map((item) => (
        String(item?.categoryId || '').trim() === id
            ? { ...item, categoryId: '' }
            : item
    ));

    return {
        categories: nextCategories,
        items: nextItems
    };
};

SmartCart.CategoryManager = {
    STORAGE_KEY_CATEGORIES,
    UNCATEGORIZED_ID,
    DEFAULT_CATEGORY,
    normalizeCategories,
    loadCategories,
    saveCategories,
    createCategoryFromName,
    migrateItemsAndCategories,
    resolveCategoryForItem,
    getFilterCategories,
    addCategory,
    updateCategory,
    removeCategory
};

window.SmartCart = SmartCart;
})();