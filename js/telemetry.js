// Lightweight browser telemetry with an explicit lifecycle. Frame sampling is
// suspended in a hidden tab, and every listener/observer belongs to one
// telemetry instance so a view can be safely disposed without affecting another.

const resolveNow = (target) => () => target?.performance?.now?.()
  ?? globalThis.performance?.now?.()
  ?? Date.now();

export const createTelemetry = ({
  target = globalThis.window,
  documentTarget = target?.document ?? globalThis.document,
  onMetric = () => {},
  PerformanceObserverCtor = globalThis.PerformanceObserver,
} = {}) => {
  const observers = [];
  const now = resolveNow(target);
  const requestFrame = target?.requestAnimationFrame?.bind(target)
    ?? globalThis.requestAnimationFrame?.bind(globalThis)
    ?? ((callback) => globalThis.setTimeout(() => callback(now()), 16));
  const cancelFrame = target?.cancelAnimationFrame?.bind(target)
    ?? globalThis.cancelAnimationFrame?.bind(globalThis)
    ?? globalThis.clearTimeout.bind(globalThis);
  let destroyed = false;
  let paused = documentTarget?.hidden === true;
  let frameHandle = null;
  let frames = 0;
  let startedAt = now();
  let lastFrame = startedAt;
  let droppedFrames = 0;
  let worstFrame = 0;
  let lastDropReport = startedAt;

  const report = (name, value) => {
    if (!destroyed) onMetric(name, value);
  };

  const observeMetric = (type, callback, options = {}) => {
    if (typeof PerformanceObserverCtor !== 'function') return;
    try {
      const observer = new PerformanceObserverCtor((list) => {
        list.getEntries().forEach((entry) => callback(entry));
      });
      observer.observe({ type, buffered: true, ...options });
      observers.push(observer);
    } catch (error) {
      console.debug(`Performance metric unavailable: ${type}`, error);
    }
  };

  const resetFrameWindow = (timestamp = now()) => {
    frames = 0;
    startedAt = timestamp;
    lastFrame = timestamp;
    droppedFrames = 0;
    worstFrame = 0;
    lastDropReport = timestamp;
  };

  const scheduleFrame = () => {
    if (destroyed || paused || frameHandle !== null) return;
    frameHandle = requestFrame(frame);
  };

  const frame = (timestamp) => {
    frameHandle = null;
    if (destroyed || paused) return;
    const current = Number.isFinite(timestamp) ? timestamp : now();
    const delta = current - lastFrame;
    if (delta > 16.7) {
      droppedFrames += 1;
      worstFrame = Math.max(worstFrame, delta);
    }
    lastFrame = current;
    frames += 1;
    if (current - startedAt >= 1000) {
      report('FPS', Math.round((frames * 1000) / (current - startedAt)));
      if (droppedFrames > 0 && current - lastDropReport >= 5000) {
        report('frame-drop-summary', { count: droppedFrames, worstFrame: Math.round(worstFrame) });
        droppedFrames = 0;
        worstFrame = 0;
        lastDropReport = current;
      }
      frames = 0;
      startedAt = current;
    }
    scheduleFrame();
  };

  const pause = () => {
    if (destroyed || paused) return false;
    paused = true;
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    return true;
  };

  const resume = () => {
    if (destroyed || !paused || documentTarget?.hidden === true) return false;
    paused = false;
    resetFrameWindow();
    scheduleFrame();
    return true;
  };

  const onVisibilityChange = () => {
    if (documentTarget?.hidden === true) pause();
    else resume();
  };
  const onError = (event) => report('error', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
  });
  const onUnhandledRejection = (event) => report('unhandled-rejection', String(event.reason));

  observeMetric('largest-contentful-paint', (entry) => report('LCP', entry.startTime));
  observeMetric('layout-shift', (entry) => {
    if (!entry.hadRecentInput) report('CLS', entry.value);
  });
  observeMetric('event', (entry) => report('INP', entry.duration), { durationThreshold: 16 });
  target?.addEventListener?.('error', onError);
  target?.addEventListener?.('unhandledrejection', onUnhandledRejection);
  documentTarget?.addEventListener?.('visibilitychange', onVisibilityChange);
  scheduleFrame();

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    observers.splice(0).forEach((observer) => observer.disconnect());
    target?.removeEventListener?.('error', onError);
    target?.removeEventListener?.('unhandledrejection', onUnhandledRejection);
    documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange);
  };

  return Object.freeze({ pause, resume, destroy });
};

// Compatibility name for the app bootstrap. New consumers can use the more
// descriptive factory name above and retain the explicit lifecycle object.
export const installTelemetry = (options = {}) => createTelemetry(options);
