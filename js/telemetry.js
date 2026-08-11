const metricObservers = [];

function observeMetric(type, callback, options = {}) {
  if (!('PerformanceObserver' in window)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) callback(entry);
    });
    observer.observe({ type, buffered: true, ...options });
    metricObservers.push(observer);
  } catch (error) {
    console.debug(`Performance metric unavailable: ${type}`, error);
  }
}

export function installTelemetry({ target = window, onMetric = () => {} } = {}) {
  observeMetric('largest-contentful-paint', (entry) => onMetric('LCP', entry.startTime));
  observeMetric('layout-shift', (entry) => {
    if (!entry.hadRecentInput) onMetric('CLS', entry.value);
  });
  observeMetric('event', (entry) => onMetric('INP', entry.duration), { durationThreshold: 16 });

  let frames = 0;
  let startedAt = performance.now();
  let lastFrame = startedAt;
  let droppedFrames = 0;
  let worstFrame = 0;
  let lastDropReport = startedAt;
  const frame = (timestamp) => {
    const delta = timestamp - lastFrame;
    if (delta > 16.7) {
      droppedFrames += 1;
      worstFrame = Math.max(worstFrame, delta);
    }
    lastFrame = timestamp;
    frames += 1;
    if (timestamp - startedAt >= 1000) {
      onMetric('FPS', Math.round((frames * 1000) / (timestamp - startedAt)));
      if (droppedFrames > 0 && timestamp - lastDropReport >= 5000) {
        onMetric('frame-drop-summary', { count: droppedFrames, worstFrame: Math.round(worstFrame) });
        droppedFrames = 0;
        worstFrame = 0;
        lastDropReport = timestamp;
      }
      frames = 0;
      startedAt = timestamp;
    }
    target.requestAnimationFrame(frame);
  };
  target.requestAnimationFrame(frame);

  target.addEventListener('error', (event) => onMetric('error', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
  }));
  target.addEventListener('unhandledrejection', (event) => onMetric('unhandled-rejection', String(event.reason)));

  return () => metricObservers.splice(0).forEach((observer) => observer.disconnect());
}
