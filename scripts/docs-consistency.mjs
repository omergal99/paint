import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const phase2 = path.join(root, 'docs/work2/phase-2');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];

const statusFiles = fs.readdirSync(phase2)
  .filter((name) => /^PHASE-2-STATUS_\d+\.md$/.test(name))
  .map((name) => ({ name, round: Number(name.match(/_(\d+)\.md$/)[1]) }))
  .sort((a, b) => b.round - a.round);

if (!statusFiles.length) {
  errors.push('No numbered Phase 2 status file exists.');
} else {
  const latest = statusFiles[0];
  const latestHtml = `PHASE-2-STATUS_${latest.round}.html`;
  const canonical = read('docs/work2/phase-2/PHASE-2-STATUS.md');
  const latestMarkdown = read(`docs/work2/phase-2/${latest.name}`);
  const latestHtmlPath = path.join(phase2, latestHtml);

  if (!fs.existsSync(latestHtmlPath)) errors.push(`Missing HTML companion: ${latestHtml}`);
  if (!canonical.includes(`(${latest.name})`)) errors.push(`Canonical status does not link to ${latest.name}.`);
  if (!canonical.includes(`(${latestHtml})`)) errors.push(`Canonical status does not link to ${latestHtml}.`);
  if (!latestMarkdown.includes('npm test')) errors.push(`${latest.name} has no test verification line.`);
  if (fs.existsSync(latestHtmlPath) && !fs.readFileSync(latestHtmlPath, 'utf8').includes('<h1>Phase 2')) {
    errors.push(`${latestHtml} has no Phase 2 heading.`);
  }

  const testCount = fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.js')).length;
  const expectedTestMarker = `${testCount}/${testCount}`;
  if (!canonical.includes(expectedTestMarker)) {
    errors.push(`Canonical status does not reflect the current test-file count (${expectedTestMarker}).`);
  }

  const progress = read('docs/work2/phase-2/PROGRESS-LOG.md');
  if (!progress.includes(`Round ${latest.round}`)) errors.push(`Progress log has no Round ${latest.round} entry.`);
}

if (errors.length) {
  console.error('Documentation consistency: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('Documentation consistency: PASS');
}
