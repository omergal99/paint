import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Sidebar } from '../js/ui/Sidebar.js';

const source = readFileSync(new URL('../js/ui/Sidebar.js', import.meta.url), 'utf8');

test('AI quick actions delegate command clicks through their stable root', () => {
	const commands = [];
	const button = {
		dataset: { aiCommand: '/zoom 100' },
		closest(selector) {
			return selector === 'button[data-ai-command]' ? this : null;
		},
	};
	const actionsRoot = { contains: (target) => target === button };
	const sidebar = Object.assign(Object.create(Sidebar.prototype), {
		aiActions: actionsRoot,
		handleAiSubmit: (command) => commands.push(command),
	});

	sidebar._handleAiActionClick({ target: button });
	assert.deepEqual(commands, ['/zoom 100']);

	sidebar._handleAiActionClick({
		target: {
			closest: () => ({ dataset: { aiCommand: '/outside' } }),
		},
	});
	assert.deepEqual(commands, ['/zoom 100'], 'commands outside the quick-actions root are ignored');
});

test('rerendered AI quick-action buttons do not own click listeners', () => {
	const renderActions = source.match(/_renderAiActions\(\) \{[\s\S]*?\n\t\}/)?.[0] || '';
	const delegatedHandler = source.match(/_handleAiActionClick\(event\) \{[\s\S]*?\n\t\}/)?.[0] || '';

	assert.doesNotMatch(renderActions, /addEventListener/);
	assert.match(renderActions, /button\.dataset\.aiCommand = command/);
	assert.match(source, /this\.aiActions\?\.addEventListener\('click', \(event\) => this\._handleAiActionClick\(event\)\)/);
	assert.match(delegatedHandler, /button\[data-ai-command\]/);
	assert.match(delegatedHandler, /this\.aiActions\.contains\(button\)/);
	assert.match(delegatedHandler, /this\.handleAiSubmit\(button\.dataset\.aiCommand\)/);
});
