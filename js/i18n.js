import { app } from "../../../scripts/app.js";

let _translations = {};
let _loaded = false;

function normalizeLocale(locale) {
    if (!locale) return 'en';
    const l = locale.toLowerCase();
    if (l.startsWith('zh')) return 'zh';
    return 'en';
}

async function loadAllLocales() {
    const results = {};
    for (const lang of ['zh', 'en']) {
        try {
            const resp = await fetch(`/preset-switcher/locales/${lang}.json`);
            if (resp.ok) {
                results[lang] = await resp.json();
            }
        } catch (e) {
            console.warn('[PresetSwitcher i18n] Failed to load locale:', lang, e);
        }
    }
    return results;
}

function registerToNative(allTranslations) {
    try {
        if (window.comfyAPI && window.comfyAPI.i18n && window.comfyAPI.i18n.mergeCustomNodesI18n) {
            window.comfyAPI.i18n.mergeCustomNodesI18n(allTranslations);
            return true;
        }
    } catch (e) {
        console.warn('[PresetSwitcher i18n] mergeCustomNodesI18n failed:', e);
    }
    return false;
}

let _initPromise = null;

async function initI18n() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        const allTranslations = await loadAllLocales();

        const locale = normalizeLocale(
            (() => {
                try { return app.ui.settings.getSettingValue('Comfy.Locale'); } catch (e) {}
                try { return (navigator.language || navigator.userLanguage || 'en').toLowerCase(); } catch (e) {}
                return 'en';
            })()
        );

        _translations = allTranslations[locale] || allTranslations['en'] || {};
        _loaded = true;

        registerToNative(allTranslations);
    })();
    return _initPromise;
}

export function t(key) {
    if (!_loaded) return key;
    return _translations[key] || key;
}

export function isPresetSwitcherNode(type) {
    return type === 'Preset Switcher (Style)' || type === 'Preset Switcher (LoRA)' ||
           type === '预设切换�?效率)' || type === '预设切换�?lora)';
}

export function isPresetSwitcherStyle(type) {
    return type === 'Preset Switcher (Style)' || type === '预设切换�?效率)';
}

export function isPresetSwitcherLoRA(type) {
    return type === 'Preset Switcher (LoRA)' || type === '预设切换�?lora)';
}

export function isPresetGallery(type) {
    return type === 'Preset Gallery' || type === '预设展示�?;
}

initI18n();