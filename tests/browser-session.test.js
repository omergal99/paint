import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeNetworkUrl } from './core/browser-session.mjs';

test('network report URLs omit credentials, query strings, and fragments', () => {
  assert.equal(
    sanitizeNetworkUrl('https://user:password@example.invalid/path?token=secret#fragment'),
    'https://example.invalid/path',
  );
  assert.equal(sanitizeNetworkUrl('malformed?token=secret'), '<invalid URL>');
});
