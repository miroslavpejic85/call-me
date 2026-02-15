// i18n.js - Client-side internationalization support
'use strict';

// Global i18n object
const i18n = {
    currentLocale: 'en',
    translations: {},
    fallbackTranslations: {},
    defaultLocale: 'en',
    availableLocales: [],
};

async function fetchTranslations(locale) {
    const response = await fetch(`/translations/${locale}`);
    if (!response.ok) {
        throw new Error(`Failed to load translations for locale: ${locale}`);
    }
    const data = await response.json();
    return data?.translations || {};
}

async function fetchAvailableLocales() {
    try {
        const response = await fetch('/locales');
        if (!response.ok) throw new Error('Failed to fetch locales');
        const data = await response.json();
        if (data?.locales?.length > 0) return data.locales;
    } catch (error) {
        console.warn('Unable to fetch available locales, using fallback list', error);
    }
    return ['en', 'es', 'fr', 'it', 'de', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja', 'hr', 'sr']; // Fallback list
}

function getLocaleLabel(locale) {
    const labels = {
        en: '🇬🇧 English',
        es: '🇪🇸 Español',
        fr: '🇫🇷 Français',
        it: '🇮🇹 Italiano',
        de: '🇩🇪 Deutsch',
        pt: '🇧🇷 Português',
        ru: '🇷🇺 Русский',
        ar: '🇸🇦 العربية',
        hi: '🇮🇳 हिन्दी',
        zh: '🇨🇳 中文',
        ja: '🇯🇵 日本語',
        hr: '🇭🇷 Hrvatski',
        sr: '🇷🇸 Srpski',
    };
    return labels[locale] || locale;
}

/**
 * Initialize i18n
 */
async function initI18n() {
    const supportedLocales = await fetchAvailableLocales();
    i18n.availableLocales = supportedLocales;

    // Determine which locale to use
    const savedLocale = localStorage.getItem('locale');
    const browserLocale = navigator.language.split('-')[0]; // Get 'en' from 'en-US'

    i18n.currentLocale =
        savedLocale && supportedLocales.includes(savedLocale)
            ? savedLocale
            : supportedLocales.includes(browserLocale)
              ? browserLocale
              : i18n.defaultLocale;

    // Always load English once as a per-key fallback
    try {
        i18n.fallbackTranslations = await fetchTranslations(i18n.defaultLocale);
    } catch (error) {
        console.warn('Unable to load fallback translations', error);
        i18n.fallbackTranslations = {};
    }

    // Load translations, set up language selector, and translate the page
    await loadTranslations(i18n.currentLocale);
    setupLanguageSelector();
    translatePage();

    console.log('i18n initialized with locale:', i18n.currentLocale);
}

/**
 * Load translations from the server
 * @param {string} locale - The locale to load
 */
async function loadTranslations(locale) {
    try {
        i18n.translations = await fetchTranslations(locale);
        i18n.currentLocale = locale;
        localStorage.setItem('locale', locale);
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to English if loading fails
        if (locale !== 'en') {
            await loadTranslations('en');
        }
    }
}

/**
 * Get translation for a key
 * @param {string} key - The translation key (supports dot notation, e.g., 'signIn.title')
 * @param {object} replacements - Object with placeholder replacements
 * @returns {string} - The translated string
 */
function t(key, replacements = {}) {
    const keys = key.split('.');

    const resolve = (source) => {
        let value = source;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        return typeof value === 'string' ? value : undefined;
    };

    const raw = resolve(i18n.translations) ?? resolve(i18n.fallbackTranslations);
    if (typeof raw !== 'string') {
        console.warn(`Translation key not found: ${key}`);
        return key;
    }

    // Replace placeholders in the translation
    return Object.entries(replacements).reduce(
        (str, [placeholder, replacement]) => str.replace(new RegExp(`__${placeholder}__`, 'g'), replacement),
        raw
    );
}

/**
 * Change the current language
 * @param {string} locale - The new locale
 */
async function changeLanguage(locale) {
    await loadTranslations(locale);
    translatePage();

    // Update language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) languageSelect.value = locale;

    // Dispatch custom event to notify other scripts that language has changed
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale } }));
}

/**
 * Setup language selector event listener
 */
function setupLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    // Rebuild options dynamically
    const locales = i18n.availableLocales.length ? i18n.availableLocales : ['en'];
    languageSelect.innerHTML = locales
        .map((locale) => `<option value="${locale}">${getLocaleLabel(locale)}</option>`)
        .join('');

    // Set current locale and add change event listener
    languageSelect.value = i18n.currentLocale;
    languageSelect.addEventListener('change', (e) => changeLanguage(e.target.value));
}

/**
 * Apply translation to an element based on attribute type
 * @param {Element} element
 * @param {string} key - Translation key
 * @param {string} attrType - 'i18n', 'placeholder', or 'title'
 */
function applyTranslation(element, key, attrType) {
    const translation = t(key);
    const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

    switch (attrType) {
        case 'i18n':
            if (isInput && (element.type === 'button' || element.type === 'submit')) {
                element.value = translation;
            } else if (isInput) {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
            break;
        case 'placeholder':
            element.placeholder = translation;
            break;
        case 'title':
            setElementTitle(element, translation);
            break;
    }
}

/**
 * Translate elements matching a selector
 * @param {Element} root - Root element to search within
 * @param {string} selector - CSS selector to find elements
 * @param {string} attribute - Attribute name (data-i18n, data-i18n-placeholder, data-i18n-title)
 * @param {string} attrType - Type for applyTranslation ('i18n', 'placeholder', 'title')
 */
function translateElements(root, selector, attribute, attrType) {
    root.querySelectorAll(selector).forEach((element) => {
        const key = element.getAttribute(attribute);
        if (key) applyTranslation(element, key, attrType);
    });
}

/**
 * Translate all elements with data-i18n attribute
 */
function translatePage() {
    const translationTypes = [
        { selector: '[data-i18n]', attribute: 'data-i18n', type: 'i18n' },
        { selector: '[data-i18n-placeholder]', attribute: 'data-i18n-placeholder', type: 'placeholder' },
        { selector: '[data-i18n-title]', attribute: 'data-i18n-title', type: 'title' },
    ];

    translationTypes.forEach(({ selector, attribute, type }) => {
        translateElements(document, selector, attribute, type);
    });

    // Update document title
    document.title = t('appTitle');

    // Custom translations for specific elements that need special handling
    updateCustomTranslations();
}

/**
 * Set element title in a way that works with Bootstrap tooltips.
 * Bootstrap may cache the initial title into the Tooltip instance config.
 * @param {Element} element
 * @param {string} translatedTitle
 */
function setElementTitle(element, translatedTitle) {
    if (!element || typeof translatedTitle !== 'string') return;

    // Keep regular title attribute in sync
    element.setAttribute('title', translatedTitle);

    // Bootstrap 5 stores original title here and may remove the title attribute
    element.setAttribute('data-bs-original-title', translatedTitle);

    // If a Bootstrap Tooltip instance already exists, update its cached config/content
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const instance = bootstrap.Tooltip.getInstance ? bootstrap.Tooltip.getInstance(element) : null;
            if (instance) {
                if (instance._config) instance._config.title = translatedTitle;
                if (typeof instance.setContent === 'function') {
                    instance.setContent({ '.tooltip-inner': translatedTitle });
                }
            }
        }
    } catch (err) {
        // No-op: translation should still work without tooltip refresh
    }
}

/**
 * Update custom translations for specific elements
 */
function updateCustomTranslations() {
    ['appTitle', 'appName'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = t(id);
    });
}

/**
 * Helper function to show translated messages using SweetAlert
 * @param {string} titleKey - Translation key for the title
 * @param {string} textKey - Translation key for the text
 * @param {string} icon - Icon type (success, error, warning, info)
 */
function showTranslatedAlert(titleKey, textKey, icon = 'info') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            heightAuto: false,
            scrollbarPadding: false,
            title: t(titleKey),
            text: t(textKey),
            icon: icon,
        });
    }
}

// i18n is initialized explicitly from client.js via: await initI18n();

// Re-translate when dynamic content is added (for mobile compatibility)
if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) translateElement(node); // Element node
            });
        });
    });

    // Start observing after a short delay to allow initial setup
    setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 100);
}

/**
 * Translate a single element and its children
 * @param {Element} element - The element to translate
 */
function translateElement(element) {
    if (!element.hasAttribute) return;

    const translationTypes = [
        { attribute: 'data-i18n', type: 'i18n' },
        { attribute: 'data-i18n-placeholder', type: 'placeholder' },
        { attribute: 'data-i18n-title', type: 'title' },
    ];

    // Translate the element itself
    translationTypes.forEach(({ attribute, type }) => {
        if (element.hasAttribute(attribute)) {
            const key = element.getAttribute(attribute);
            if (key) applyTranslation(element, key, type);
        }
    });

    // Translate children
    if (element.querySelectorAll) {
        translationTypes.forEach(({ attribute, type }) => {
            translateElements(element, `[${attribute}]`, attribute, type);
        });
    }
}
