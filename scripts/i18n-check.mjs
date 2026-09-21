import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EN_MESSAGES,
	MESSAGE_CATALOGS,
	getMessageTemplate,
	listMessageKeys,
} from '../js/i18n/messages.js';
import { UI_TEXT_KEYS, UI_TEXT_PATTERNS } from '../js/i18n/uiText.js';
import { LOCALE_METADATA, SUPPORTED_LOCALES } from '../js/i18n/localeRegistry.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const englishKeys = new Set(listMessageKeys(EN_MESSAGES));

const checkCatalog = (locale, catalog) => {
	if (!catalog) {
		errors.push(`${locale}: ready locale has no catalog`);
		return;
	}
	for (const key of englishKeys) {
		if (getMessageTemplate(catalog, key) === undefined) errors.push(`${locale}: missing ${key}`);
	}
};

SUPPORTED_LOCALES.filter((locale) => LOCALE_METADATA[locale]?.status === 'ready')
	.forEach((locale) => checkCatalog(locale, MESSAGE_CATALOGS[locale]));

for (const key of Object.values(UI_TEXT_KEYS)) {
	if (!englishKeys.has(key)) errors.push(`UI_TEXT_KEYS points to missing English key: ${key}`);
}
for (const { key } of UI_TEXT_PATTERNS) {
	if (!englishKeys.has(key)) errors.push(`UI_TEXT_PATTERNS points to missing English key: ${key}`);
}

const markup = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
for (const key of markup.matchAll(/data-i18n="([^"]+)"/g)) {
	if (!englishKeys.has(key[1])) errors.push(`index.html references missing key: ${key[1]}`);
}

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
	const fullPath = path.join(directory, entry.name);
	if (entry.isDirectory()) return walk(fullPath);
	return entry.name.endsWith('.js') ? [fullPath] : [];
});

for (const file of walk(path.join(projectRoot, 'js'))) {
	const source = fs.readFileSync(file, 'utf8');
	for (const match of source.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) {
		if (!englishKeys.has(match[2])) errors.push(`${path.relative(projectRoot, file)} references missing key: ${match[2]}`);
	}
}
for (const attribute of markup.matchAll(/data-i18n-attr="([^"]+)"/g)) {
	for (const mapping of attribute[1].split(',')) {
		const key = mapping.split(':').slice(1).join(':').trim();
		if (key && !englishKeys.has(key)) errors.push(`index.html references missing key: ${key}`);
	}
}

if (errors.length > 0) {
	console.error(`i18n check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
	errors.forEach((error) => console.error(`- ${error}`));
	process.exitCode = 1;
} else {
	const ready = SUPPORTED_LOCALES.filter((locale) => LOCALE_METADATA[locale]?.status === 'ready');
	console.log(`i18n check passed: ${ready.join(', ')} cover ${englishKeys.size} keys; ${Object.keys(UI_TEXT_KEYS).length} UI labels mapped.`);
}
