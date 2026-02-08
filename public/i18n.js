// i18n.js - Client-side internationalization support
'use strict';

// Global i18n object
const i18n = {
    currentLocale: 'en',
    translations: {},
    defaultLocale: 'en',
    availableLocales: [],
};

async function fetchAvailableLocales() {
    try {
        const response = await fetch('/locales');
        if (!response.ok) throw new Error('Failed to fetch locales');
        const data = await response.json();
        if (data && Array.isArray(data.locales) && data.locales.length > 0) {
            return data.locales;
        }
    } catch (error) {
        console.warn('Unable to fetch available locales, using fallback list', error);
    }
    return ['en', 'es', 'fr', 'it', 'de'];
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
    };
    return labels[locale] || locale;
}

/**
 * Initialize i18n
 */
async function initI18n() {
    // Get saved locale from localStorage or use browser language or default
    const savedLocale = localStorage.getItem('locale');
    const browserLocale = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
    const supportedLocales = await fetchAvailableLocales();
    i18n.availableLocales = supportedLocales;

    // Determine which locale to use
    if (savedLocale && supportedLocales.includes(savedLocale)) {
        i18n.currentLocale = savedLocale;
    } else if (supportedLocales.includes(browserLocale)) {
        i18n.currentLocale = browserLocale;
    } else {
        i18n.currentLocale = i18n.defaultLocale;
    }

    // Load translations
    await loadTranslations(i18n.currentLocale);

    // Set up language selector
    setupLanguageSelector();

    // Translate the page
    translatePage();

    console.log('i18n initialized with locale:', i18n.currentLocale);
}

/**
 * Load translations from the server
 * @param {string} locale - The locale to load
 */
async function loadTranslations(locale) {
    try {
        const response = await fetch(`/translations/${locale}`);
        if (!response.ok) {
            throw new Error(`Failed to load translations for locale: ${locale}`);
        }
        const data = await response.json();
        i18n.translations = data.translations;
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
    let value = i18n.translations;

    // Navigate through nested keys
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return the key itself if translation not found
        }
    }

    // If value is an object, return the key (shouldn't happen with proper keys)
    if (typeof value === 'object') {
        console.warn(`Translation key is an object, not a string: ${key}`);
        return key;
    }

    // Replace placeholders in the translation
    let translation = value;
    for (const [placeholder, replacement] of Object.entries(replacements)) {
        translation = translation.replace(new RegExp(`__${placeholder}__`, 'g'), replacement);
    }

    return translation;
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
    if (languageSelect) {
        languageSelect.value = locale;
    }

    // Dispatch custom event to notify other scripts that language has changed
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale } }));
}

/**
 * Setup language selector event listener
 */
function setupLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        // Rebuild options dynamically
        const locales =
            Array.isArray(i18n.availableLocales) && i18n.availableLocales.length ? i18n.availableLocales : ['en'];
        languageSelect.innerHTML = '';
        locales.forEach((locale) => {
            const option = document.createElement('option');
            option.value = locale;
            option.textContent = getLocaleLabel(locale);
            languageSelect.appendChild(option);
        });

        // Set current locale
        languageSelect.value = i18n.currentLocale;

        // Add change event listener
        languageSelect.addEventListener('change', async (e) => {
            const newLocale = e.target.value;
            await changeLanguage(newLocale);
        });
    }
}

/**
 * Translate all elements with data-i18n attribute
 */
function translatePage() {
    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);

        // Update the appropriate property based on element type
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.type === 'button' || element.type === 'submit') {
                element.value = translation;
            } else {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Translate elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });

    // Translate elements with data-i18n-title attribute (for tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key);
    });

    // Update document title
    document.title = t('appTitle');

    // Custom translations for specific elements that need special handling
    updateCustomTranslations();
}

/**
 * Update custom translations for specific elements
 */
function updateCustomTranslations() {
    // Update app title
    const appTitle = document.getElementById('appTitle');
    if (appTitle) appTitle.textContent = t('appTitle');

    // Update app name
    const appName = document.getElementById('appName');
    if (appName) appName.textContent = t('appName');

    // Update settings title for language
    const settingsTitles = document.querySelectorAll('.settings-title');
    if (settingsTitles.length > 0) {
        settingsTitles[0].innerHTML = '<i class="fas fa-globe"></i> ' + t('settings.language');
    }
    if (settingsTitles.length > 1) {
        settingsTitles[1].innerHTML = '<i class="fas fa-video"></i> Media Devices';
    }
    if (settingsTitles.length > 2) {
        settingsTitles[2].innerHTML = '<i class="fas fa-comments"></i> Chat Settings';
    }
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
            title: t(titleKey),
            text: t(textKey),
            icon: icon,
        });
    }
}

// Initialize i18n when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    // DOM already loaded, initialize immediately
    initI18n();
}

// Re-translate when dynamic content is added (for mobile compatibility)
if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Element node
                        translateElement(node);
                    }
                });
            }
        });
    });

    // Start observing after a short delay to allow initial setup
    setTimeout(() => {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }, 100);
}

/**
 * Translate a single element and its children
 * @param {Element} element - The element to translate
 */
function translateElement(element) {
    // Translate data-i18n
    if (element.hasAttribute && element.hasAttribute('data-i18n')) {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.type === 'button' || element.type === 'submit') {
                element.value = translation;
            } else {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    }

    // Translate data-i18n-placeholder
    if (element.hasAttribute && element.hasAttribute('data-i18n-placeholder')) {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    }

    // Translate data-i18n-title
    if (element.hasAttribute && element.hasAttribute('data-i18n-title')) {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key);
    }

    // Recursively translate children
    if (element.querySelectorAll) {
        element.querySelectorAll('[data-i18n]').forEach((child) => {
            const key = child.getAttribute('data-i18n');
            const translation = t(key);

            if (child.tagName === 'INPUT' || child.tagName === 'TEXTAREA') {
                if (child.type === 'button' || child.type === 'submit') {
                    child.value = translation;
                } else {
                    child.placeholder = translation;
                }
            } else {
                child.textContent = translation;
            }
        });

        element.querySelectorAll('[data-i18n-placeholder]').forEach((child) => {
            const key = child.getAttribute('data-i18n-placeholder');
            child.placeholder = t(key);
        });

        element.querySelectorAll('[data-i18n-title]').forEach((child) => {
            const key = child.getAttribute('data-i18n-title');
            child.title = t(key);
        });
    }
}
