import { createBrushStrokeRenderer } from './BrushStrokeRenderer.js';

const makeBrushHistoryEntry = (brush, color) => ({
	size: brush.size,
	alpha: brush.alpha,
	flow: brush.flow,
	hardness: brush.hardness,
	spacing: brush.spacing,
	tipShape: brush.tipShape,
	stabilizer: brush.stabilizer,
	color,
});

const pressureFor = (event) => {
	if (!['pen', 'touch'].includes(event?.pointerType)) return 1;
	const pressure = Number(event?.pressure);
	return Number.isFinite(pressure) && pressure > 0 ? Math.max(0, Math.min(1, pressure)) : 1;
};

const createFreehandTool = (name, { sizeAware = true } = {}) => {
	let drawing = false;
	let last = null;
	let lastRaw = null;
	let lastTime = 0;
	let renderer = null;
	let activeBrush = null;
	let activeColor = null;
	let activeColorAlpha = 1;

	const strokeColorFor = (button, ctx) => (
		button === 2 ? ctx.canvasManager.secondaryColor : ctx.canvasManager.primaryColor
	);

	const applyStyle = (point, ctx) => {
		const canvasContext = ctx.canvasManager.ctx;
		canvasContext.lineJoin = 'round';
		canvasContext.lineCap = 'round';
		const isEraser = name === 'eraser';
		canvasContext.strokeStyle = isEraser
			? ctx.canvasManager.backgroundColor
			: strokeColorFor(point.button, ctx);
		canvasContext.globalAlpha = isEraser
			? 1
			: point.button === 2 ? ctx.canvasManager.secondaryAlpha : ctx.canvasManager.primaryAlpha;
		canvasContext.lineWidth = name === 'pencil' ? 1 : ctx.canvasManager.lineWidth;
	};

	const resetStroke = () => {
		drawing = false;
		last = null;
		lastRaw = null;
		lastTime = 0;
		renderer = null;
		activeBrush = null;
		activeColor = null;
		activeColorAlpha = 1;
	};

	const drawBrushTo = (point, event) => {
		if (!activeBrush || !renderer) return;
		const elapsed = Math.max(1, Number(event?.timeStamp) - lastTime || 16);
		const distance = lastRaw ? Math.hypot(point.x - lastRaw.x, point.y - lastRaw.y) : 0;
		const speed = Math.min(1, distance / elapsed / 2);
		const pressure = pressureFor(event);
		const dynamics = activeBrush.dynamics || {};
		const sizeMultiplier = (dynamics.pressureSize ? 0.25 + pressure * 0.75 : 1)
			* (1 - (dynamics.speedSize || 0) * speed * 0.75);
		const flowMultiplier = (dynamics.pressureFlow ? 0.15 + pressure * 0.85 : 1)
			* (1 - (dynamics.speedFlow || 0) * speed * 0.8);
		const smoothing = Math.max(0.25, 1 / (1 + activeBrush.stabilizer * 3));
		const smoothed = last
			? { x: last.x + (point.x - last.x) * smoothing, y: last.y + (point.y - last.y) * smoothing }
			: point;
		renderer.drawTo(smoothed, activeColorAlpha * activeBrush.alpha * flowMultiplier, sizeMultiplier);
		last = smoothed;
		lastRaw = point;
		lastTime = Number(event?.timeStamp) || lastTime + 16;
	};

	const rememberBrush = (ctx) => {
		if (!activeBrush || typeof ctx.setBrushState !== 'function') return;
		const entry = makeBrushHistoryEntry(activeBrush, activeColor);
		const signature = JSON.stringify(entry);
		const history = (ctx.getBrushState?.().history || [])
			.filter((item) => JSON.stringify(item) !== signature);
		ctx.setBrushState({ history: [entry, ...history].slice(0, 12) });
	};

	const onDown = (point, ctx, event) => {
		ctx.historyManager.snapshot();
		drawing = true;
		last = null;
		lastRaw = null;
		lastTime = Number(event?.timeStamp) || 0;

		if (name === 'brush') {
			activeBrush = ctx.getBrushState?.() || {
				size: ctx.canvasManager.lineWidth,
				alpha: 1,
				flow: 1,
				hardness: 1,
				spacing: 0.2,
				tipShape: 'round',
				stabilizer: 0,
			};
			activeColor = strokeColorFor(point.button, ctx);
			activeColorAlpha = point.button === 2
				? ctx.canvasManager.secondaryAlpha
				: ctx.canvasManager.primaryAlpha;
			renderer = createBrushStrokeRenderer(ctx.canvasManager.ctx, activeBrush, {
				color: activeColor,
				alpha: activeColorAlpha * activeBrush.alpha,
			});
			drawBrushTo(point, event);
			return;
		}

		applyStyle(point, ctx);
		const canvasContext = ctx.canvasManager.ctx;
		canvasContext.beginPath();
		canvasContext.moveTo(point.x, point.y);
		canvasContext.lineTo(point.x + 0.01, point.y + 0.01);
		canvasContext.stroke();
		last = point;
	};

	const onMove = (point, ctx, event) => {
		if (!drawing) return;
		if (name === 'brush') {
			drawBrushTo(point, event);
			return;
		}
		const canvasContext = ctx.canvasManager.ctx;
		canvasContext.beginPath();
		canvasContext.moveTo(last.x, last.y);
		canvasContext.lineTo(point.x, point.y);
		canvasContext.stroke();
		last = point;
	};

	const onUp = (point, ctx, event) => {
		if (name === 'brush' && drawing && point && lastRaw
			&& (point.x !== lastRaw.x || point.y !== lastRaw.y)) {
			drawBrushTo(point, event);
		}
		if (name === 'brush' && drawing) rememberBrush(ctx);
		resetStroke();
	};

	const onCancel = () => resetStroke();

	return { name, cursor: 'crosshair', sizeAware, onDown, onMove, onUp, onCancel };
};

export const createPencilTool = () => createFreehandTool('pencil');

export const createBrushTool = () => createFreehandTool('brush');

export const createEraserTool = () => {
	const tool = createFreehandTool('eraser');
	tool.cursor = 'cell';
	return tool;
};
