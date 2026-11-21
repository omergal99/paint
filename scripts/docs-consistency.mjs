import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const requiredFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.github/CODE_OF_CONDUCT.md',
  '.agents/skills/README.md',
  '.agents/skills/deterministic-test-fixer/SKILL.md',
  '.skills/README.md',
  'docs/README.md',
  'docs/architecture/overview.md',
  'docs/adr/README.md',
  'docs/adr/architecture/ADR-0001-module-extraction-lessons.md',
  'docs/adr/testing/ADR-0002-local-deterministic-browser-tests.md',
  'docs/tests/README.md',
  'docs/community/standards.md',
  'docs/guides/initial-loading.md',
  'docs/guides/loading-params.md',
  'docs/guides/releasing.md',
  'docs/guides/ui-patterns.md',
  'docs/reports/project-audit.md',
  'tests/README.md',
  'tests/skills/SKILL.md',
];

requiredFiles.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing documentation: ${file}`);
});

const walkMarkdown = (directory) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkMarkdown(entryPath);
    if (entry.isFile() && entry.name.endsWith('.md')) {
      return [path.relative(root, entryPath).split(path.sep).join('/')];
    }
    return [];
  });
};

const documents = [...new Set([...requiredFiles, ...walkMarkdown(path.join(root, 'docs'))])];
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
