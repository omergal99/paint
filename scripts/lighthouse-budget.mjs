import fs from 'node:fs';

const [reportPath, ...thresholds] = process.argv.slice(2);
if (!reportPath) throw new Error('Usage: node scripts/lighthouse-budget.mjs <report.json> [category=score]');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const required = thresholds.length ? thresholds : ['performance=0.9'];
const failures = [];

for (const threshold of required) {
  const [category, rawMinimum] = threshold.split('=');
  const minimum = Number(rawMinimum);
  const score = report.categories?.[category]?.score;
  if (!Number.isFinite(minimum) || !Number.isFinite(score)) {
    failures.push(`${category}: invalid threshold or missing Lighthouse category`);
    continue;
  }
  if (score < minimum) failures.push(`${category}: ${(score * 100).toFixed(0)} is below ${(minimum * 100).toFixed(0)}`);
  else console.log(`${category}: ${(score * 100).toFixed(0)} meets ${(minimum * 100).toFixed(0)}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`Lighthouse budget failed - ${failure}`));
  process.exitCode = 1;
}
