// js/app/bootTiming.js
// Boot phase marks. Phase 3 modularisation: every extracted module reports when
// it is wired, so "the app is slow to feel ready" can be measured instead of
// guessed. Marks are cheap (a few microseconds) and only used when the User
// Timing API exists, so they never block boot.
const marks = [];

export const markBoot = (name, detail) => {
  if (typeof performance?.mark !== 'function') return;
  try {
    performance.mark(name, detail ? { detail } : undefined);
    marks.push({ name, at: Math.round(performance.now()) });
  } catch {
    // Older engines reject the options bag; the name alone is still useful.
    try { performance.mark(name); } catch { /* timing is best-effort */ }
  }
};

/** Phase timeline for diagnostics (`bootTiming()` in the console). */
export const bootTiming = () => marks.slice();