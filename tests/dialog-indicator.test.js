import assert from 'node:assert/strict';
import test from 'node:test';

import { appendDialogIndicator } from '../js/ui/DialogIndicator.js';

const makeDocument = () => ({
  createTextNode(textContent) {
    return { textContent };
  },
  createElementNS(namespaceURI, localName) {
    return {
      namespaceURI,
      localName,
      attributes: new Map(),
      children: [],
      setAttribute(name, value) { this.attributes.set(name, value); },
      append(...children) { this.children.push(...children); },
      querySelector(selector) {
        if (selector !== ':scope > .dialog-arrow-icon') return null;
        return this.children.find((child) => child.attributes?.get('class') === 'dialog-arrow-icon') || null;
      },
    };
  },
});

test('dialog indicator uses the shared inline SVG and can be appended only once', () => {
  const documentRef = makeDocument();
  const action = {
    children: [],
    querySelector: (selector) => selector === ':scope > .dialog-arrow-icon'
      ? action.children.find((child) => child.attributes?.get('class') === 'dialog-arrow-icon') || null
      : null,
    append(...children) { this.children.push(...children); },
  };

  const icon = appendDialogIndicator(action, { documentRef });
  assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(icon.attributes.get('viewBox'), '0 0 24 24');
  assert.equal(icon.attributes.get('width'), '16');
  assert.equal(icon.attributes.get('height'), '16');
  assert.equal(icon.attributes.get('aria-hidden'), 'true');
  assert.deepEqual(icon.children.map((child) => child.localName), ['path', 'line', 'polyline']);
  assert.equal(appendDialogIndicator(action, { documentRef }), null);
  assert.equal(action.children.length, 2);
  assert.equal(action.children[0].textContent, ' ');
});
