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
    getFilterCategories
};

window.SmartCart = SmartCart;
})();