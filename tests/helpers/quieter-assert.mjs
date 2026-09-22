import assert from 'node:assert/strict';

const CONTEXT_CHARS = 120;

const buildContext = (source, index) => {
  const start = Math.max(0, index - CONTEXT_CHARS / 2);
  const snippet = source.slice(start, start + CONTEXT_CHARS).replace(/\s+/g, ' ').trim();
  const line = source.slice(0, index).split('\n').length;
  return `(around source line ${line}) "${snippet}${start + CONTEXT_CHARS < source.length ? '…' : ''}"`;
};

const longestLiteralChunk = (regex) =>
  (regex.source.match(/[A-Za-z0-9_=".\-\\][A-Za-z0-9_=".\-\\]{5,}/g) || [''])
    .reduce((best, chunk) => (chunk.length > best.length ? chunk : best), '');

const describePattern = (regex) => `/${regex.source.replace(/\n/g, '\\n')}/${regex.flags}`;

const firstNonMatchingSpot = (source, regex) => {
  const m = regex.exec(source);
  if (m) return null;
  // Binary-search the longest prefix of the source the pattern still matches,
  // so the report shows how far the match got before diverging.
  let low = 0;
  let high = source.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (regex.test(source.slice(0, mid))) low = mid;
    else high = mid - 1;
  }
  regex.lastIndex = 0;
  return low;
};

const diagnoseMatch = (value, regex) => {
  if (typeof value !== 'string') return `input is ${typeof value}, not a string`;
  const spot = firstNonMatchingSpot(value, regex);
  if (spot >= CONTEXT_CHARS) return `match diverges at: ${buildContext(value, spot)}`;
  // Match got nowhere: anchor on the longest literal chunk of the pattern.
  const anchor = longestLiteralChunk(regex).replace(/\\(.)/g, '$1');
  const at = anchor ? value.indexOf(anchor) : -1;
  if (at >= 0) return `pattern anchor ${JSON.stringify(anchor)} is present, but the rest does not follow: ${buildContext(value, at)}`;
  return `no anchor of the pattern exists in the input (input: ${value.length} chars)`;
};

const quieterAssert = new Proxy(assert, {
  get(target, prop, receiver) {
    if (prop === 'match') {
      return (value, regex, message) => {
        try {
          return target.match(value, regex, message);
        } catch (error) {
          error.message = `Expected ${describePattern(regex)} to match. ${diagnoseMatch(value, regex)}${message ? ` — ${message}` : ''}`;
          error.expected = describePattern(regex);
          error.actual = typeof value === 'string' ? `${value.length}-char source (snippet suppressed; see message context)` : value;
          throw error;
        }
      };
    }
    if (prop === 'doesNotMatch') {
      return (value, regex, message) => {
        try {
          return target.doesNotMatch(value, regex, message);
        } catch (error) {
          const m = typeof value === 'string' ? regex.exec(value) : null;
          error.message = `Expected ${describePattern(regex)} NOT to match.${m ? ` Matched at: ${buildContext(value, m.index + m[0].length)}` : ''}${message ? ` — ${message}` : ''}`;
          error.expected = `no match for ${describePattern(regex)}`;
          error.actual = m ? value.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60) : value;
          throw error;
        }
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export default quieterAssert;
