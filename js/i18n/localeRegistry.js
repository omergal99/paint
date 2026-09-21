// Locale metadata is the single registry used by the selector, document
// direction, and future catalog loaders. A locale is "ready" only when its
// catalog is complete for the enabled locale set; future entries may remain
// planned and disabled until their catalog and visual review are complete.

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = Object.freeze([
	'en',
	'es',
	'pt-br',
	'fr',
	'de',
	'ar',
	'ja',
]);

export const LOCALE_METADATA = Object.freeze({
	en: Object.freeze({ label: 'English', nativeLabel: 'English', direction: 'ltr', status: 'ready' }),
	es: Object.freeze({ label: 'Spanish', nativeLabel: 'Español', direction: 'ltr', status: 'ready' }),
	'pt-br': Object.freeze({ label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)', direction: 'ltr', status: 'ready' }),
	fr: Object.freeze({ label: 'French', nativeLabel: 'Français', direction: 'ltr', status: 'ready' }),
	de: Object.freeze({ label: 'German', nativeLabel: 'Deutsch', direction: 'ltr', status: 'ready' }),
	ar: Object.freeze({ label: 'Arabic', nativeLabel: 'العربية', direction: 'rtl', status: 'ready' }),
	ja: Object.freeze({ label: 'Japanese', nativeLabel: '日本語', direction: 'ltr', status: 'ready' }),
});

const textValue = (value) => {
	if (value === null || value === undefined) return '';
	return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
};

export const normalizeLocale = (locale, fallback = DEFAULT_LOCALE) => {
	const normalized = textValue(locale).trim().replace(/_/g, '-').toLowerCase();
	if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalized)) return fallback;
	return normalized;
};

export const localeCandidates = (locale, fallback = DEFAULT_LOCALE) => {
	const normalized = normalizeLocale(locale, fallback);
	const base = normalized.split('-')[0];
	return normalized === base ? [normalized] : [normalized, base];
};

export const getLocaleMetadata = (locale) => {
	const candidates = localeCandidates(locale);
	return candidates.map((candidate) => LOCALE_METADATA[candidate]).find(Boolean)
		|| LOCALE_METADATA[DEFAULT_LOCALE];
};

export const isSupportedLocale = (locale) => SUPPORTED_LOCALES.includes(normalizeLocale(locale));

export const isLocaleReady = (locale) => getLocaleMetadata(locale).status === 'ready';

// Return the catalog/selector key, not a browser-specific variant such as
// `en-us`, so a select element always has a matching option.
export const resolveLocale = (locale) => localeCandidates(locale)
	.find((candidate) => SUPPORTED_LOCALES.includes(candidate)) || DEFAULT_LOCALE;
