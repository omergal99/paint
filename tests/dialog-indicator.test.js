import assert from 'node:assert/strict';
import test from 'node:test';

import { appendDialogIndicator, initializeDialogIndicators } from '../js/ui/DialogIndicator.js';
import { getIconHtml, ICONS } from '../js/ui/icons/index.js';

// Minimal element stand-in: it records inserted markup and exposes the one
// selector appendDialogIndicator uses for its "append exactly once" guard.
const makeAction = () => {
  const action = {
    inserted: [],
    children: [],
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforeend');
      action.inserted.push(html);
      action.children.push({ attributes: new Map([['class', 'dialog-arrow-icon']]) });
    },
    querySelector(selector) {
      if (selector !== ':scope > .dialog-arrow-icon') return null;
      return action.children.find((child) => child.attributes.get('class') === 'dialog-arrow-icon') || null;
    },
  };
  return action;
};

test('the dialog arrow glyph is owned by the shared icon registry and sized for menus', () => {
  assert.match(ICONS.dialogArrow, /viewBox="0 0 24 24"/);
  assert.match(ICONS.dialogArrow, /width="14" height="14"/);
  assert.match(ICONS.dialogArrow, /class="dialog-arrow-icon"/);
  assert.equal(getIconHtml('doesNotExist'), '');
  assert.match(getIconHtml('dialogArrow', 'extra'), /class="extra dialog-arrow-icon"/);
});

test('appendDialogIndicator inserts the shared glyph exactly once', () => {
  const action = makeAction();
  const icon = appendDialogIndicator(action);
  assert.ok(icon, 'the appended icon is returned');
  assert.equal(action.inserted.length, 1);
  assert.ok(action.inserted[0].startsWith(' '), 'a space separates the label from the icon');
  assert.match(action.inserted[0], /class="dialog-arrow-icon"/);
  assert.equal(appendDialogIndicator(action), null, 'a second append is a no-op');
  assert.equal(action.inserted.length, 1);
  assert.equal(appendDialogIndicator(null), null);
});

test('initializeDialogIndicators marks every dialog-opening action', () => {
  const found = [];
  const queriedTags = [];
  const root = {
    querySelector: (selector) => {
      const match = /\[data-tag="(.+)"\]/.exec(selector);
      if (!match) return null;
      queriedTags.push(match[1]);
      const action = makeAction();
      found.push(action);
      return action;
    },
  };
  const count = initializeDialogIndicators({ root });
  assert.equal(count, 12);
  assert.ok(found.every((action) => action.inserted.length === 1));
  assert.ok(!queriedTags.includes('btn-resize-quick'), 'the quick Resize ribbon button has no dialog arrow');
  assert.ok(queriedTags.includes('btn-canvas-size'), 'the Image menu Resize action keeps its dialog arrow');
});
