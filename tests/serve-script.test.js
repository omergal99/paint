import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { contentTypeFor, projectRoot, resolveRequestPath } from '../scripts/serve.mjs';

test('the dependency-free local server resolves only safe project files', async () => {
  const index = await resolveRequestPath({ directory: projectRoot, pathname: '/' });
  const app = await resolveRequestPath({ directory: projectRoot, pathname: '/js/app.js' });
  const traversal = await resolveRequestPath({ directory: projectRoot, pathname: '/..%2Fpackage.json' });
  const malformed = await resolveRequestPath({ directory: projectRoot, pathname: '/%ZZ' });

  assert.equal(index, path.join(projectRoot, 'index.html'));
  assert.equal(app, path.join(projectRoot, 'js/app.js'));
  assert.equal(traversal, null);
  assert.equal(malformed, null);
});

test('the local server exposes browser-safe MIME types without dependencies', () => {
  assert.match(contentTypeFor('index.html'), /text\/html/);
  assert.match(contentTypeFor('js/app.js'), /text\/javascript/);
  assert.equal(contentTypeFor('css/assets/icon-512.png'), 'image/png');
  assert.equal(contentTypeFor('unknown.bin'), 'application/octet-stream');
});
