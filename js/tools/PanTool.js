// Hand/Pan tool: move the scrollable canvas viewport without changing zoom or pixels.
// The tool consumes raw pointer coordinates because panning is a viewport concern,
// not an image-coordinate drawing operation.

const setPanMode = (viewport, active) => {
  viewport?.classList.toggle('pan-mode', active);
};

const setPanningState = (viewport, active) => {
  viewport?.classList.toggle('is-panning', active);
};

export const createPanTool = () => {
  let drag = null;

  const viewportFor = (ctx) => ctx.viewportManager?.viewportEl;

  const onActivate = (ctx) => {
    setPanMode(viewportFor(ctx), true);
    setPanningState(viewportFor(ctx), false);
  };

  const onDeactivate = (ctx) => {
    drag = null;
    setPanMode(viewportFor(ctx), false);
    setPanningState(viewportFor(ctx), false);
  };

  const onDown = (_point, ctx, event) => {
    const viewport = viewportFor(ctx);
    if (!viewport || event.button !== 0) return;
    event.preventDefault();
    drag = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      pointerId: event.pointerId,
    };
    setPanningState(viewport, true);
  };

  const onMove = (_point, ctx, event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewport = viewportFor(ctx);
    if (!viewport) return;
    event.preventDefault();
    viewport.scrollLeft = drag.scrollLeft + drag.clientX - event.clientX;
    viewport.scrollTop = drag.scrollTop + drag.clientY - event.clientY;
  };

  const onUp = (_point, ctx, event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    setPanningState(viewportFor(ctx), false);
  };

  const onCancel = (_point, ctx) => {
    drag = null;
    setPanningState(viewportFor(ctx), false);
  };

  return {
    name: 'pan',
    cursor: 'grab',
    onActivate,
    onDeactivate,
    onDown,
    onMove,
    onUp,
    onCancel,
  };
};
