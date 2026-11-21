import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const skillsDirectory = path.join(root, '.agents', 'skills');
const recordsDirectory = path.join(root, '.skills', 'audit', 'statistics', 'usage', 'records');
const skillIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStatuses = new Set(['used', 'not-used', 'not-applicable']);

const isValidIsoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
};

export const getReviewGate = (sessionCount) => {
  if (sessionCount >= 50) return 'full-review';
  if (sessionCount >= 20) return 'selective-review';
  return 'collecting';
};

export const validateUsageRecords = (records) => {
  const sessions = new Set();
  for (const [recordIndex, record] of records.entries()) {
    const recordNumber = recordIndex + 1;
    if (!record || typeof record.session_id !== 'string' || !record.session_id.trim()) {
      throw new Error(`Record ${recordNumber}: session_id must be a non-empty string.`);
    }
    if (sessions.has(record.session_id)) {
      throw new Error(`Record ${recordNumber}: duplicate session_id "${record.session_id}".`);
    }
    sessions.add(record.session_id);

    if (!isValidIsoDate(record.date)) {
      throw new Error(`Record ${recordNumber}: date must be a valid YYYY-MM-DD value.`);
    }
    if (!Array.isArray(record.skills)) {
      throw new Error(`Record ${recordNumber}: skills must be an array.`);
    }

    const skillIds = new Set();
    for (const [skillIndex, skill] of record.skills.entries()) {
      const skillNumber = skillIndex + 1;
      if (!skill || typeof skill.id !== 'string' || !skillIdPattern.test(skill.id)) {
        throw new Error(`Record ${recordNumber}, skill ${skillNumber}: invalid skill id.`);
      }
      if (skillIds.has(skill.id)) {
        throw new Error(`Record ${recordNumber}: duplicate skill id "${skill.id}".`);
      }
      skillIds.add(skill.id);

      if (!allowedStatuses.has(skill.status)) {
        throw new Error(`Record ${recordNumber}, ${skill.id}: invalid status.`);
      }
      if (Object.hasOwn(skill, 'source_check')) {
        let sourceUrl;
        try {
          sourceUrl = new URL(skill.source_check?.url);
        } catch {
          throw new Error(`Record ${recordNumber}, ${skill.id}: source_check requires an HTTPS URL.`);
        }
        if (sourceUrl.protocol !== 'https:' || !isValidIsoDate(skill.source_check?.date)) {
          throw new Error(`Record ${recordNumber}, ${skill.id}: source_check requires an HTTPS URL and valid date.`);
        }
      }
      if (skill.status === 'used') {
        if (!Number.isInteger(skill.rating) || skill.rating < 1 || skill.rating > 5) {
          throw new Error(`Record ${recordNumber}, ${skill.id}: used skills require a rating from 1 to 5.`);
        }
        if (typeof skill.evidence !== 'string' || !skill.evidence.trim()) {
          throw new Error(`Record ${recordNumber}, ${skill.id}: used skills require brief evidence.`);
        }
      } else {
        if (Object.hasOwn(skill, 'rating')) {
          throw new Error(`Record ${recordNumber}, ${skill.id}: only used skills may have a rating.`);
        }
        if (typeof skill.reason !== 'string' || !skill.reason.trim()) {
          throw new Error(`Record ${recordNumber}, ${skill.id}: ${skill.status} requires a brief reason.`);
        }
      }
    }
  }
  return records;
};

export const summarizeUsageRecords = (records) => {
  validateUsageRecords(records);
  const skills = new Map();
  for (const record of records) {
    for (const entry of record.skills) {
      const stats = skills.get(entry.id) || {
        id: entry.id,
        uses: 0,
        ratingTotal: 0,
        ratings: 0,
        notUsed: 0,
        notApplicable: 0,
      };
      if (entry.status === 'used') {
        stats.uses += 1;
        stats.ratingTotal += entry.rating;
        stats.ratings += 1;
      } else if (entry.status === 'not-used') {
        stats.notUsed += 1;
      } else {
        stats.notApplicable += 1;
      }
      skills.set(entry.id, stats);
    }
  }

  const rankedSkills = [...skills.values()]
    .map((stats) => ({
      ...stats,
      averageRating: stats.ratings ? stats.ratingTotal / stats.ratings : null,
    }))
    .sort((left, right) => (
      right.uses - left.uses
      || (right.averageRating ?? -1) - (left.averageRating ?? -1)
      || left.id.localeCompare(right.id)
    ));

  return {
    sessionCount: records.length,
    reviewGate: getReviewGate(records.length),
    skills: rankedSkills,
  };
};

const findJsonlFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findJsonlFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.jsonl') ? [entryPath] : [];
    })
    .sort();
};

const loadUsageRecords = () => findJsonlFiles(recordsDirectory).flatMap((file) => (
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .flatMap((line, index) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line)];
      } catch (error) {
        throw new Error(`${path.relative(root, file)}:${index + 1}: invalid JSON (${error.message})`);
      }
    })
));

const readSkillMetadata = (directoryName) => {
  const skillFile = path.join(skillsDirectory, directoryName, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    throw new Error(`${directoryName}: missing SKILL.md.`);
  }
  const content = fs.readFileSync(skillFile, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`${directoryName}/SKILL.md: missing YAML frontmatter.`);

  const nameMatch = frontmatter[1].match(/^name:\s*(.+)\s*$/m);
  const descriptionMatch = frontmatter[1].match(/^description:\s*(.+)\s*$/m);
  const unquote = (value) => value?.replace(/^["']|["']$/g, '').trim();
  const name = unquote(nameMatch?.[1]);
  const description = unquote(descriptionMatch?.[1]);

  if (!name || !skillIdPattern.test(name) || name !== directoryName) {
    throw new Error(`${directoryName}/SKILL.md: name must be a matching lowercase skill id.`);
  }
  if (!description || description.length > 1024) {
    throw new Error(`${directoryName}/SKILL.md: description must be 1–1024 characters.`);
  }
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > 500) {
    throw new Error(`${directoryName}/SKILL.md: ${lineCount} lines exceeds the 500-line guidance.`);
  }
  return name;
};

const validateSkillCatalog = () => {
  const skillDirectories = fs.readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return skillDirectories.map(readSkillMetadata);
};

const validateSkillReferences = () => {
  const walkMarkdown = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkMarkdown(entryPath);
      return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
    });
  const files = walkMarkdown(skillsDirectory);
  for (const file of files) {
    const markdown = fs.readFileSync(file, 'utf8');
    for (const [, target] of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const targetPath = target.split('#')[0];
      if (!targetPath || /^(https?:|mailto:)/i.test(targetPath)) continue;
      const decodedPath = decodeURIComponent(targetPath);
      if (!fs.existsSync(path.resolve(path.dirname(file), decodedPath))) {
        throw new Error(`${path.relative(root, file)}: broken local reference "${target}".`);
      }
    }
  }
};

const main = () => {
  const catalog = validateSkillCatalog();
  validateSkillReferences();
  const summary = summarizeUsageRecords(loadUsageRecords());
  console.log(`Loadable skills: ${catalog.length} valid`);
  console.log(`Recorded sessions: ${summary.sessionCount}`);
  console.log('Skill use (uses / mean usefulness / considered not used / not applicable):');
  if (summary.skills.length === 0) {
    console.log('  No skill-use observations recorded; absence is not evidence of non-use.');
  } else {
    for (const skill of summary.skills) {
      const average = skill.averageRating === null ? 'n/a' : skill.averageRating.toFixed(2);
      console.log(`  ${skill.id}: ${skill.uses} / ${average} / ${skill.notUsed} / ${skill.notApplicable}`);
    }
  }
  if (summary.reviewGate === 'full-review') {
    console.log('Review gate: 50+ sessions; offer a broader cleanup and relevance review.');
  } else if (summary.reviewGate === 'selective-review') {
    console.log('Review gate: 20+ sessions; offer a selective cleanup and revision review.');
  } else {
    console.log(`Review gate: collecting evidence (${summary.sessionCount}/20 sessions); no cleanup suggestion yet.`);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
