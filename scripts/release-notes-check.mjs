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

// History must never be rewritten. Two entries claiming one version, or a
// gap-free descending order, means an entry was edited after shipping instead
// of prepended - which is how the 1.7.0 notes were lost when 1.8.0 was cut.
const seen = new Map();
for (const entry of RELEASE_NOTES) {
  if (seen.has(entry.version)) errors.push(`Duplicate release note entry for ${entry.version}.`);
  seen.set(entry.version, entry);
}

const parsed = (value) => String(value || '').split('.').map((part) => Number.parseInt(part, 10) || 0);
const compare = (a, b) => {
  const left = parsed(a);
  const right = parsed(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};
// Newest first. Anything ascending means a shipped entry was moved or removed.
for (let i = 1; i < RELEASE_NOTES.length; i += 1) {
  if (compare(RELEASE_NOTES[i - 1].version, RELEASE_NOTES[i].version) <= 0) {
    errors.push(`Release notes are not newest-first at ${RELEASE_NOTES[i - 1].version} -> ${RELEASE_NOTES[i].version}.`);
  }
}

// Every highlight key referenced by any entry must still resolve, so a renamed
// key cannot blank out past releases either.
const knownKeys = new Set(listMessageKeys(EN_MESSAGES));
for (const entry of RELEASE_NOTES) {
  for (const key of entry.highlightKeys || []) {
    if (!knownKeys.has(key)) errors.push(`${entry.version}: highlight has no English text: ${key}`);
  }
}

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