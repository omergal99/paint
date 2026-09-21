import assert from 'node:assert/strict';
import test from 'node:test';

import {
	assertMessageCoverage,
	createI18n,
	EN_MESSAGES,
	findMarkupMessageKeys,
	findMissingMessageKeys,
	I18N_LOCALE_STORAGE_KEY,
	MESSAGE_CATALOGS,
	setDefaultLocale,
	listMessageKeys,
	REQUIRED_MESSAGE_KEYS,
	t,
} from '../js/i18n/messages.js';
import { ES_MESSAGES } from '../js/i18n/catalogs/es.js';
import {
	DEFAULT_LOCALE,
	LOCALE_METADATA,
	SUPPORTED_LOCALES,
	getLocaleMetadata,
	isLocaleReady,
	localeCandidates,
	normalizeLocale,
	resolveLocale,
} from '../js/i18n/localeRegistry.js';
import { createLocaleController } from '../js/i18n/LocaleController.js';
import { UI_TEXT_KEYS } from '../js/i18n/uiText.js';

const memoryStorage = (initial = {}) => {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
	};
};

test('English catalog covers every declared markup/module key and contains no HTML templates', () => {
	assert.deepEqual(findMissingMessageKeys(REQUIRED_MESSAGE_KEYS), []);
	assert.equal(assertMessageCoverage(REQUIRED_MESSAGE_KEYS), true);
	assert.deepEqual(findMarkupMessageKeys(EN_MESSAGES), []);
	assert.deepEqual(
		findMarkupMessageKeys({ status: { unsafe: 'Do not use <strong>HTML</strong>' } }),
		['status.unsafe'],
	);
});

test('t interpolates text values, preserves an omitted placeholder, and has a stable missing-key result', () => {
	assert.equal(t('ribbon.annotations.currentTool', { tool: 'Pencil' }), 'Current tool: Pencil');
	assert.equal(t('status.imageOpened', { name: 'sunset.png' }), 'Opened sunset.png');
	assert.equal(t('status.imageOpened'), 'Opened {name}');
	assert.equal(t('missing.message'), '[missing:missing.message]');
	setDefaultLocale('es');
	assert.equal(t('common.actions.save'), 'Guardar');
	setDefaultLocale('en');
});

test('createI18n falls back from an incomplete locale to English and persists a chosen locale safely', () => {
	const storage = memoryStorage({ [I18N_LOCALE_STORAGE_KEY]: 'fr-CA' });
	const i18n = createI18n({
		storage,
		catalogs: {
			fr: {
				common: { actions: { save: 'Enregistrer' } },
				status: { saved: 'Enregistré' },
			},
		},
	});
	assert.equal(i18n.getLocale(), 'fr-ca');
	assert.equal(i18n.t('common.actions.save'), 'Enregistrer');
	assert.equal(i18n.t('status.saved'), 'Enregistré');
	assert.equal(i18n.t('history.title'), 'History', 'missing French text uses English');
	assert.equal(i18n.setLocale('de-DE'), 'de-de');
	assert.equal(storage.getItem(I18N_LOCALE_STORAGE_KEY), 'de-de');
	assert.equal(i18n.t('common.actions.cancel'), 'Cancel', 'unknown locale uses English');
});

test('coverage checker names absent keys instead of silently accepting them', () => {
	assert.deepEqual(
		findMissingMessageKeys(['common.actions.save', 'notepad.missing']),
		['notepad.missing'],
	);
	assert.throws(
		() => assertMessageCoverage(['notepad.missing']),
		/Missing English message keys: notepad\.missing/,
	);
});

test('locale registry keeps language mapping, fallback, and RTL metadata explicit', () => {
	assert.equal(DEFAULT_LOCALE, 'en');
	assert.deepEqual(localeCandidates('pt_BR'), ['pt-br', 'pt']);
	assert.equal(normalizeLocale('ar-EG'), 'ar-eg');
	assert.equal(resolveLocale('en-US'), 'en');
	assert.equal(getLocaleMetadata('ar-EG').direction, 'rtl');
	assert.equal(isLocaleReady('en'), true);
	assert.equal(isLocaleReady('es'), true, 'Spanish is enabled only after catalog coverage passes');
	assert.equal(isLocaleReady('ar'), true, 'reviewed Arabic catalog is enabled');
	assert.deepEqual(Object.keys(LOCALE_METADATA), SUPPORTED_LOCALES);
});

test('locale controller renders every reviewed option and restores a saved locale', () => {
	const options = [];
	const select = {
		value: '',
		replaceChildren: () => { options.length = 0; },
		append: (option) => options.push(option),
		addEventListener: () => {},
	};
	const root = {
		dataset: {},
		ownerDocument: { createElement: () => ({ dataset: {} }) },
		querySelectorAll: () => [],
		dispatchEvent: () => true,
	};
	const status = { textContent: '' };
	const storage = memoryStorage({ [I18N_LOCALE_STORAGE_KEY]: 'ar' });
	const controller = createLocaleController({ root, select, status, storage });
	controller.bind();
	assert.equal(controller.getLocale(), 'ar');
	assert.equal(select.value, 'ar');
	assert.equal(root.lang, 'ar');
	assert.equal(root.dir, 'rtl');
	assert.equal(options.length, SUPPORTED_LOCALES.length);
	assert.equal(options.find((option) => option.value === 'ar').disabled, false);
	assert.match(status.textContent, /العربية is ready/);
	assert.equal(controller.setDirection('ltr'), 'ltr');
	assert.equal(root.dir, 'ltr');
	assert.equal(controller.setDirection('auto'), 'rtl');
	assert.equal(root.dir, 'rtl');
});

test('Spanish catalog is complete before the locale is marked ready', () => {
	assert.deepEqual(findMissingMessageKeys(listMessageKeys(EN_MESSAGES), ES_MESSAGES), []);
	assert.deepEqual(findMissingMessageKeys(Object.values(UI_TEXT_KEYS), ES_MESSAGES), []);
	const i18n = createI18n({ locale: 'es', catalogs: { es: ES_MESSAGES } });
	assert.equal(i18n.t('common.actions.save'), 'Guardar');
	assert.equal(i18n.t('settings.languageReady', { language: 'Español' }), 'Español está disponible');
});

test('every supported locale has complete catalog coverage', () => {
	SUPPORTED_LOCALES.forEach((locale) => {
		assert.deepEqual(findMissingMessageKeys(listMessageKeys(EN_MESSAGES), MESSAGE_CATALOGS[locale]), [], locale);
	});
});

test('shared UI text mapping has one stable key per reusable source label', () => {
	const labels = Object.keys(UI_TEXT_KEYS);
	assert.equal(labels.length, new Set(labels).size);
	assert.deepEqual(findMissingMessageKeys(Object.values(UI_TEXT_KEYS), EN_MESSAGES), []);
	assert.deepEqual(findMissingMessageKeys(Object.values(UI_TEXT_KEYS), ES_MESSAGES), []);
});
