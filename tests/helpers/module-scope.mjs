// Static guard against temporal dead zone (TDZ) failures in module scope.
//
// Both regressions this file was written for were the same mistake: a binding
// declared with `const` further down the module was referenced from a position
// that runs while the module is still evaluating, so the reference threw
// `ReferenceError: Cannot access 'x' before initialization`.
//
//   - `renderSegmentedChoices` was passed into `initHistoryControls(...)`,
//     an immediately invoked factory, hundreds of lines above its `const`.
//   - `saveSettings` closed over `getDefaultZoom`, destructured from a factory
//     created much later, and only reported the failure through `console.warn`.
//
// The rule enforced here is deliberately narrow, because the naive version
// floods the results with harmless hits: a reference inside a function body is
// deferred until that function is called, so it only fails if the function runs
// before the declaration. Only references that execute *while the module body
// is evaluating* are genuine hazards.
//
//   "Executes during evaluation" means: not inside a function body, arrow body,
//   method body or class body. Braces used for object literals, argument lists
//   and destructuring do not defer anything.

const stripCommentsAndStrings = (source) => {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { out += source[i] === '\n' ? '\n' : ' '; i += 1; }
      out += '  ';
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ' ';
      i += 1;
      while (i < n) {
        if (source[i] === '\\') { out += '  '; i += 2; continue; }
        if (source[i] === ch) { out += ' '; i += 1; break; }
        // Unterminated quote: stop at the line break rather than eating the file.
        if (source[i] === '\n') break;
        out += ' ';
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
};

const isIdentChar = (ch) => Boolean(ch) && /[A-Za-z0-9_$]/.test(ch);
const isIdentStart = (ch) => Boolean(ch) && /[A-Za-z_$]/.test(ch);

/**
 * Marks, per character, whether it sits inside a function/class body. Only
 * those regions defer execution; every other brace is plain grouping.
 */
const markDeferred = (cleaned) => {
  const n = cleaned.length;
  const deferred = new Uint8Array(n);
  const stack = [];
  let deferredDepth = 0;
  let pendingBody = false;
  let arrowExpression = false;
  let i = 0;

  const mark = () => { deferred[i] = (deferredDepth > 0 || arrowExpression) ? 1 : 0; };

  while (i < n) {
    const ch = cleaned[i];
    if (isIdentStart(ch)) {
      let end = i;
      while (end < n && isIdentChar(cleaned[end])) end += 1;
      const word = cleaned.slice(i, end);
      if (word === 'function' || word === 'class' || word === 'catch' || word === 'finally') pendingBody = true;
      // Any other word means the next `{` is not this arrow's body, e.g.
      // `=> [...nodes]` or `=> ({ a })`, where the expression wraps itself.
      else pendingBody = false;
      if (/^(if|for|while|switch|return|const|let|var|await|throw)$/.test(word)) arrowExpression = false;
      for (let k = i; k < end; k += 1) deferred[k] = (deferredDepth > 0 || arrowExpression) ? 1 : 0;
      i = end;
      continue;
    }
    if (ch === '=' && cleaned[i + 1] === '>') {
      mark(); mark();
      // `=> {` opens a deferred body; `=> expr` defers the expression itself
      // until the statement ends. Set both so either shape is handled.
      pendingBody = true;
      arrowExpression = true;
      i += 2;
      continue;
    }
    if (ch === '{') {
      const isBody = pendingBody;
      pendingBody = false;
      arrowExpression = false;
      stack.push({ isBody });
      if (isBody) deferredDepth += 1;
      mark();
      i += 1;
      continue;
    }
    if (ch === '}') {
      const top = stack.pop();
      if (top?.isBody) deferredDepth -= 1;
      mark();
      i += 1;
      continue;
    }
    if (ch === '(' || ch === '[') {
      // A bracket here means the arrow body is a wrapped expression, not a block.
      pendingBody = false;
      stack.push({ isBody: false });
      mark();
      i += 1;
      continue;
    }
    if (ch === ')' || ch === ']') { stack.pop(); mark(); i += 1; continue; }
    if (ch === ';') arrowExpression = false;
    mark();
    i += 1;
  }
  return deferred;
};
// Bracket depth at the start of each line, used to find module-scope statements.
const computeLineDepths = (cleaned) => {
  const depths = [0];
  let depth = 0;
  for (const ch of cleaned) {
    if (ch === '\n') { depths.push(depth); continue; }
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
  }
  return depths;
};

const namesFromPattern = (pattern) => pattern
  .split(',')
  .map((part, index) => {
    const trimmed = part.trim().replace(/^\.{3}/, '');
    const name = (/^[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)$/.exec(trimmed)?.[1] ?? part.split(/[=:]/)[0].trim());
    // Report where the *name* sits, not where the pattern opens, so a multi-line
    // destructuring points at the exact line a reader has to look at.
    const offset = pattern.indexOf(trimmed, pattern.split(',').slice(0, index).join(',').length);
    return { name, offset: offset === -1 ? 0 : offset };
  })
  .filter((entry) => /^[A-Za-z_$][\w$]*$/.test(entry.name));

// Read a `{ a, b }` / `[a, b]` binding pattern, which may span many lines.
const readBindingPattern = (text, start) => {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) { depth -= 1; if (depth === 0) return text.slice(start + 1, i); }
  }
  return '';
};

/** Map every module-scope binding name to the 1-based line that initialises it. */
export const moduleScopeDeclarations = (source) => {
  const cleaned = stripCommentsAndStrings(source);
  const deferred = markDeferred(cleaned);
  const depths = computeLineDepths(cleaned);

  // Offset of each line start, so a character offset can be turned into a line.
  const lineStart = [0];
  for (let i = 0; i < cleaned.length; i += 1) if (cleaned[i] === '\n') lineStart.push(i + 1);
  const lineOf = (offset) => {
    let lo = 0;
    let hi = lineStart.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStart[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
  const isModuleScope = (offset) => {
    const line = lineOf(offset);
    return depths[line - 1] === 0 && !deferred[offset];
  };

  const declarations = new Map();
  const re = /(?:^|[\n;])\s*(?:const|let|class)\s+/g;
  let match;
  while ((match = re.exec(cleaned))) {
    const nameStart = match.index + match[0].length;
    if (!isModuleScope(match.index)) continue;
    if (cleaned[nameStart] === '{' || cleaned[nameStart] === '[') {
      const pattern = readBindingPattern(cleaned, nameStart);
      for (const { name, offset } of namesFromPattern(pattern)) {
        declarations.set(name, lineOf(nameStart + 1 + offset));
      }
      re.lastIndex = nameStart + pattern.length;
      continue;
    }
    const simple = /^[A-Za-z_$][\w$]*/.exec(cleaned.slice(nameStart));
    if (simple) declarations.set(simple[0], lineOf(nameStart));
  }
  return declarations;
};

/**
 * Module-scope bindings referenced from a position that runs during module
 * evaluation *before* the line that initialises them. Each entry is a
 * `ReferenceError` waiting to happen.
 */
export const findUseBeforeDeclaration = (source) => {
  const cleaned = stripCommentsAndStrings(source);
  const deferred = markDeferred(cleaned);
  const declarations = moduleScopeDeclarations(source);
  const lines = cleaned.split('\n');
  const hazards = [];
  let offset = 0;

  lines.forEach((text, index) => {
    const lineNo = index + 1;
    const re = /(?<![.\w$])([A-Za-z_$][\w$]*)/g;
    let match;
    while ((match = re.exec(text))) {
      const name = match[1];
      const declaredAt = declarations.get(name);
      if (declaredAt === undefined || lineNo >= declaredAt) continue;
      if (deferred[offset + match.index]) continue;
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + name.length).trimStart();
      // `key: value` in an object literal: the identifier is a property name.
      // A ternary `? a : b` is a reference, so only skip when the colon is not
      // preceded by `?`.
      if (after.startsWith(':') && !/[?:]\s*$/.test(before)) continue;
      hazards.push({ name, usedAtLine: lineNo, declaredAtLine: declaredAt });
    }
    offset += text.length + 1;
  });
  return hazards;
};

/**
 * Module-scope bindings a named top-level function closes over that are
 * declared *below* the function. Deferred, so this is not an immediate
 * ReferenceError - but if the function is ever reachable during module
 * evaluation (or the module throws part-way, leaving it wired to uninitialised
 * bindings) it fails at runtime instead of at load time.
 */
export const forwardDependencies = (source, fnName) => {
  const cleaned = stripCommentsAndStrings(source);
  const declarations = moduleScopeDeclarations(source);
  const lines = cleaned.split('\n');
  const startRe = new RegExp(`^(?:const|let|function)\\s+${fnName}\\b`);
  let startIndex = -1;
  for (let i = 0; i < lines.length; i += 1) if (startRe.test(lines[i])) { startIndex = i; break; }
  if (startIndex === -1) return null;

  let depth = 0;
  let opened = false;
  const bodyLines = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth += 1; opened = true; }
      else if (ch === '}') depth -= 1;
    }
    bodyLines.push(lines[i]);
    if (opened && depth === 0) break;
  }

  const names = new Set();
  const re = /(?<![.\w$])([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = re.exec(bodyLines.join('\n')))) names.add(match[1]);

  const forward = [];
  for (const name of names) {
    const declaredAt = declarations.get(name);
    if (declaredAt !== undefined && declaredAt > startIndex + 1) forward.push({ name, declaredAtLine: declaredAt });
  }
  return { declaredAtLine: startIndex + 1, forward };
};