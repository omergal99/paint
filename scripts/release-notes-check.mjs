// Release gate: the newest entry must describe the version actually shipping.
//
// Bumping package.json is easy and writing the notes is not, so without this
// check a release can silently ship with yesterday's highlights (or a dangling
// "unreleased" placeholder). Every highlight key must also resolve to real text
// in the English catalog, so a renamed key cannot pass unnoticed either.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_VERSION } from '../js/version.js';
import { RELEASE_NOTES } from '../js/releaseNotes.js';
import { EN_MESSAGES, getMessageTemplate, listMessageKeys } from '../js/i18n/messages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const newest = RELEASE_NOTES[0];
if (!newest) {
  errors.push('RELEASE_NOTES is empty.');
} else {
  if (newest.version !== APP_VERSION) {
    errors.push(`Newest release note is ${newest.version}, but the app ships ${APP_VERSION}.`);
  }
  if (/unreleased/i.test(newest.version)) {
    errors.push('Newest release note is still an unreleased placeholder.');
  }
  if (!Array.isArray(newest.highlightKeys) || newest.highlightKeys.length === 0) {
    errors.push('Newest release note has no highlights.');
  }
  const known = new Set(listMessageKeys(EN_MESSAGES));
  for (const key of newest.highlightKeys || []) {
    if (!known.has(key)) {
      errors.push(`Release note highlight has no English text: ${key}`);
      continue;
    }
    if (!String(getMessageTemplate(EN_MESSAGES, key) || '').trim()) {
      errors.push(`Release note highlight is empty: ${key}`);
    }
  }
}

// A version with no notes at all is the failure this gate exists to catch.
const released = new Set(RELEASE_NOTES.map((entry) => entry.version));
if (!released.has(APP_VERSION)) errors.push(`No release notes entry for shipping version ${APP_VERSION}.`);

if (errors.length) {
  console.error('Release notes check: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Release notes check: PASS (${APP_VERSION}, ${newest?.highlightKeys?.length || 0} highlights)`);

// Keep the file's own version in sync for the docs tooling that reads it.
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (packageVersion !== APP_VERSION) {
  console.error(`Release notes check: FAIL\n- package.json is ${packageVersion}, js/version.js is ${APP_VERSION} (run: npm run version:sync)`);
  process.exit(1);
}