export default async function* jsonTestReporter(source) {
  const tests = [];
  const diagnostics = [];

  for await (const event of source) {
    if (['test:pass', 'test:fail', 'test:skip', 'test:todo'].includes(event.type)) {
      tests.push({
        type: event.type,
        name: event.data?.name || 'Unknown test',
        nesting: event.data?.nesting ?? 0,
        durationMs: event.data?.details?.duration_ms ?? null,
        error: event.data?.details?.error || null,
      });
    } else if (['test:stdout', 'test:stderr', 'test:diagnostic'].includes(event.type)) {
      diagnostics.push({
        type: event.type,
        message: event.data?.message || event.data?.line || '',
      });
    }
  }

  yield JSON.stringify({ schemaVersion: 1, tests, diagnostics });
}
