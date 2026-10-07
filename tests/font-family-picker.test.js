import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../js/ui/FontFamilyPicker.js', import.meta.url), 'utf8');

test('font options delegate selection and pointer focus handling through the listbox', () => {
	const optionFactory = source.match(/const options = families\.map\([\s\S]*?\n\t\}\);/)?.[0] || '';
	const delegatedHandlers = source.match(/const getOptionFromEvent[\s\S]*?const handleTriggerClick/)?.[0] || '';

	assert.doesNotMatch(optionFactory, /addEventListener/);
	assert.match(delegatedHandlers, /event\.target\?\.closest\?\.\('\.font-family-picker-option'\)/);
	assert.match(delegatedHandlers, /event\.preventDefault\(\)/);
	assert.match(delegatedHandlers, /event\.stopPropagation\(\)/);
	assert.match(delegatedHandlers, /selectFamily\(option\.dataset\.fontValue\)/);
	assert.match(delegatedHandlers, /close\(\{ returnFocus: true \}\)/);
	assert.match(source, /listbox\.addEventListener\('pointerdown', handleOptionPointerdown\)/);
	assert.match(source, /listbox\.addEventListener\('click', handleOptionClick\)/);
	assert.match(source, /listbox\.removeEventListener\('pointerdown', handleOptionPointerdown\)/);
	assert.match(source, /listbox\.removeEventListener\('click', handleOptionClick\)/);
});
