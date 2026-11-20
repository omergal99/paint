import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const requiredFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/ARCHITECTURE.md',
  'docs/AUDIT-REPORT.md',
  'docs/COMMUNITY_STANDARDS.md',
  'docs/INITIAL_LOADING.md',
  'docs/RELEASING.md',
  'docs/UI-PATTERNS.md',
];

requiredFiles.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing public guide: ${file}`);
});

const documents = [...requiredFiles];
if (fs.existsSync(path.join(root, 'docs-internal/README.md'))) {
  documents.push('docs-internal/README.md');
}
if (fs.existsSync(path.join(root, 'docs-internal/CURRENT-PLAN.md'))) {
  documents.push('docs-internal/CURRENT-PLAN.md');
}

for (const document of documents) {
  const documentPath = path.join(root, document);
  if (!fs.existsSync(documentPath)) continue;
  const contents = fs.readFileSync(documentPath, 'utf8');
  const links = contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);

  for (const [, rawTarget] of links) {
    const target = rawTarget.trim().split(/[\s#]/, 1)[0].replace(/^<|>$/g, '');
    if (!target || target.startsWith('#') || target.startsWith('//') || /^[a-z]+:/i.test(target)) continue;
    const resolved = path.resolve(path.dirname(documentPath), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) {
      errors.push(`${document} links to missing path: ${target}`);
    }
  }
}

if (errors.length) {
  console.error('Documentation consistency: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Documentation consistency: PASS (${documents.length} guides checked).`);
}
