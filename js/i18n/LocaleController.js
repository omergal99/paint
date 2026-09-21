import {
	DEFAULT_LOCALE,
	LOCALE_METADATA,
	SUPPORTED_LOCALES,
	getLocaleMetadata,
	isLocaleReady,
	normalizeLocale,
	resolveLocale,
} from './localeRegistry.js';
import { createI18n, I18N_LOCALE_STORAGE_KEY, MESSAGE_CATALOGS, setDefaultLocale } from './messages.js';
import { UI_TEXT_KEYS, UI_TEXT_PATTERNS } from './uiText.js';

const STATUS_LABELS = Object.freeze({ ready: 'ready', planned: 'planned' });

const safeDispatch = (root, locale, metadata, direction = metadata.direction) => {
	if (typeof root?.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
	root.dispatchEvent(new CustomEvent('paint:locale-change', {
		detail: { locale, direction, metadata },
	}));
};

const TEXT_ATTRIBUTES = Object.freeze(['title', 'aria-label', 'placeholder']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'SVG']);

const trimText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const resolveText = (source) => {
	if (!source) return null;
	const directKey = UI_TEXT_KEYS[source];
	if (directKey) return { key: directKey, variables: {} };
	for (const entry of UI_TEXT_PATTERNS) {
		const match = source.match(entry.pattern);
		if (match) return { key: entry.key, variables: entry.variables(match), source };
	}
	return null;
};

const translateLeaf = (element, i18n) => {
	if (!element || SKIP_TAGS.has(element.tagName)) return;
	const explicitKey = element.getAttribute?.('data-i18n');
	const runtimeKey = element.getAttribute?.('data-i18n-runtime');
	const runtimeSource = element.getAttribute?.('data-i18n-runtime-source') || trimText(element.textContent);
	const resolved = resolveText(runtimeSource);
	const key = explicitKey || runtimeKey || resolved?.key;
	if (!key) return;
	if (explicitKey || runtimeKey || !element.children?.length) {
		if (!explicitKey && !runtimeKey) {
			element.setAttribute('data-i18n-runtime', key);
			if (resolved?.source) element.setAttribute('data-i18n-runtime-source', resolved.source);
		}
		const translated = i18n.t(key, resolved?.variables);
		if (element.textContent !== translated) element.textContent = translated;
	}
};

const translateDirectTextNodes = (element, i18n) => {
	if (!element || SKIP_TAGS.has(element.tagName) || !element.children?.length) return;
	const nodes = [...element.childNodes].filter((node) => node.nodeType === 3);
	nodes.forEach((node) => {
		const source = trimText(node.nodeValue);
		const key = source && UI_TEXT_KEYS[source];
		if (!key) return;
		const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
		const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
		const translated = `${leading}${i18n.t(key)}${trailing}`;
		if (node.nodeValue !== translated) node.nodeValue = translated;
	});
};

const translateAttributes = (element, i18n) => {
	if (!element || SKIP_TAGS.has(element.tagName)) return;
	const explicit = new Map();
	(element.getAttribute?.('data-i18n-attr')?.split(',') || []).forEach((mapping) => {
		const separator = mapping.indexOf(':');
		if (separator < 1) return;
		explicit.set(mapping.slice(0, separator).trim(), mapping.slice(separator + 1).trim());
	});
	TEXT_ATTRIBUTES.forEach((attribute) => {
		const explicitKey = explicit.get(attribute);
		const runtimeAttribute = `data-i18n-runtime-${attribute}`;
		const runtimeKey = element.getAttribute?.(runtimeAttribute);
		const source = runtimeKey ? null : trimText(element.getAttribute?.(attribute));
		const key = explicitKey || runtimeKey || (source ? UI_TEXT_KEYS[source] : null);
		if (!key) return;
		if (!explicitKey && !runtimeKey) element.setAttribute(runtimeAttribute, key);
		const translated = i18n.t(key);
		if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
	});
};

const applyTranslations = (root, i18n) => {
	if (!root?.querySelectorAll) return;
	const elements = [root, ...root.querySelectorAll('*')];
	elements.forEach((element) => {
		if (element.nodeType !== 1) return;
		translateLeaf(element, i18n);
		translateDirectTextNodes(element, i18n);
		translateAttributes(element, i18n);
	});
};

export const createLocaleController = ({
	root = globalThis.document?.documentElement,
	select = null,
	status = null,
	storage = globalThis.localStorage,
	catalogs = MESSAGE_CATALOGS,
	storageKey = I18N_LOCALE_STORAGE_KEY,
	i18n = createI18n({ storage, catalogs, storageKey }),
} = {}) => {
	let applying = false;
	let observer = null;
	let directionOverride = null;
	const resolveDirection = (metadata) => directionOverride || metadata.direction;
	const applyDirection = (metadata) => {
		if (!root) return;
		const direction = resolveDirection(metadata);
		root.dir = direction;
		root.dataset.localeDirection = direction;
	};
	const renderOptions = () => {
		if (!select) return;
		const ownerDocument = root?.ownerDocument || globalThis.document;
		if (!ownerDocument?.createElement) return;
		select.replaceChildren();
		SUPPORTED_LOCALES.forEach((locale) => {
			const metadata = LOCALE_METADATA[locale];
			const option = ownerDocument.createElement('option');
			option.value = locale;
			option.textContent = `${metadata.nativeLabel} - ${metadata.label}${metadata.status === STATUS_LABELS.planned ? ' (planned)' : ''}`;
			option.disabled = !isLocaleReady(locale);
			option.dataset.localeStatus = metadata.status;
			select.append(option);
		});
	};

	const updateStatus = (metadata) => {
		if (!status) return;
		status.textContent = i18n.t(
			metadata.status === STATUS_LABELS.ready ? 'settings.languageReady' : 'settings.languagePlanned',
			{ language: metadata.nativeLabel },
		);
	};

	const apply = (locale = i18n.getLocale(), { persist = true } = {}) => {
		const normalized = normalizeLocale(locale);
		// A saved locale can outlive a catalog rollout. Keep the document and
		// selector coherent by falling back to the reviewed default until the
		// requested language is actually ready.
		const safeLocale = isLocaleReady(normalized) ? resolveLocale(normalized) : DEFAULT_LOCALE;
		const activeLocale = i18n.setLocale(safeLocale, { persist });
		setDefaultLocale(activeLocale);
		const metadata = getLocaleMetadata(activeLocale);
		if (root) {
			root.lang = activeLocale;
			applyDirection(metadata);
			root.dataset.locale = activeLocale;
			if (!applying) {
				applying = true;
				try { applyTranslations(root, i18n); } finally { applying = false; }
			}
		}
		if (select) select.value = activeLocale;
		updateStatus(metadata);
		safeDispatch(root, activeLocale, metadata, resolveDirection(metadata));
		return activeLocale;
	};

	const bind = () => {
		renderOptions();
		apply();
		select?.addEventListener('change', () => apply(select.value));
		if (root && globalThis.MutationObserver && typeof root.querySelectorAll === 'function') {
			observer?.disconnect?.();
			observer = new globalThis.MutationObserver((records) => {
				if (applying) return;
			const additions = records.flatMap((record) => [record.target, ...record.addedNodes])
				.filter((node) => node?.nodeType === 1);
				if (additions.length === 0) return;
				applying = true;
				try { additions.forEach((node) => applyTranslations(node, i18n)); } finally { applying = false; }
			});
			observer.observe(root, { childList: true, subtree: true });
		}
		return controller;
	};

	const setDirection = (direction = 'auto') => {
		directionOverride = direction === 'ltr' || direction === 'rtl' ? direction : null;
		const metadata = getLocaleMetadata(i18n.getLocale());
		applyDirection(metadata);
		safeDispatch(root, i18n.getLocale(), metadata, resolveDirection(metadata));
		return resolveDirection(metadata);
	};

	const controller = Object.freeze({
		bind,
		apply,
		setDirection,
		renderOptions,
		getLocale: () => i18n.getLocale(),
		getMetadata: () => getLocaleMetadata(i18n.getLocale()),
		i18n,
	});
	return controller;
};
