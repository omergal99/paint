// Shared text measurement and rendering primitives.
// TextTool owns the live DOM editor; TextLayerService owns the committed layer.

export const TEXT_EDITOR_LAYOUT = Object.freeze({
	topOffsetPercent: -70,
	canvasTextOffsetPercent: -50,
	lineHeightPercent: 1.2,
});

export const getTextLineHeight = (fontSize) => Number(fontSize) * TEXT_EDITOR_LAYOUT.lineHeightPercent;

export const getCanvasTextOffset = (fontSize) => (
	Number(fontSize) * TEXT_EDITOR_LAYOUT.canvasTextOffsetPercent / 100
);

export const getTextStyleSet = (styles = []) => {
	if (styles instanceof Set) return new Set(styles);
	return new Set(Array.isArray(styles) ? styles : styles ? [styles] : []);
};

export const getTextFont = ({ fontSize, fontFamily = 'Segoe UI', styles = [] } = {}) => {
	const styleSet = getTextStyleSet(styles);
	const fontStyle = styleSet.has('italic') ? 'italic' : 'normal';
	const fontWeight = styleSet.has('bold') ? '700' : '400';
	return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
};

const colorToCss = (color = {}) => {
	const r = Math.max(0, Math.min(255, Number(color.r) || 0));
	const g = Math.max(0, Math.min(255, Number(color.g) || 0));
	const b = Math.max(0, Math.min(255, Number(color.b) || 0));
	return `rgb(${r}, ${g}, ${b})`;
};

export const measureTextObject = ({ context, object } = {}) => {
	if (!context || !object) return { width: 0, height: 0 };
	const fontSize = Math.max(1, Number(object.fontSize) || 16);
	const lines = String(object.text || '').split('\n');
	context.save();
	context.font = getTextFont({ fontSize, fontFamily: object.fontFamily, styles: object.styles });
	const width = Math.max(0, ...lines.map((line) => context.measureText(line).width));
	context.restore();
	return {
		width,
		height: Math.max(getTextLineHeight(fontSize), lines.length * getTextLineHeight(fontSize)),
	};
};

export const renderTextObject = ({ context, object } = {}) => {
	if (!context || !object || !String(object.text || '')) return false;
	const fontSize = Math.max(1, Number(object.fontSize) || 16);
	const styleSet = getTextStyleSet(object.styles);
	const lineHeight = getTextLineHeight(fontSize);
	const lines = String(object.text).split('\n');
	const color = colorToCss(object.color);
	const alphaValue = Number(object.color?.a);

	context.save();
	context.globalAlpha = Math.max(0, Math.min(1, Number.isFinite(alphaValue) ? alphaValue : 1));
	context.fillStyle = color;
	context.font = getTextFont({ fontSize, fontFamily: object.fontFamily, styles: object.styles });
	context.textBaseline = 'top';
	if (styleSet.has('shadow')) {
		context.shadowColor = 'rgba(0,0,0,.45)';
		context.shadowBlur = Math.max(2, fontSize * .12);
		context.shadowOffsetX = fontSize * .08;
		context.shadowOffsetY = fontSize * .08;
	}
	if (styleSet.has('neon')) {
		context.shadowColor = color;
		context.shadowBlur = Math.max(6, fontSize * .25);
	}

	lines.forEach((line, index) => {
		const lineX = Number(object.x) + 1;
		const lineY = Number(object.y) + index * lineHeight;
		if (styleSet.has('outline') || styleSet.has('black-outline')) {
			context.strokeStyle = styleSet.has('black-outline') ? '#000' : color;
			context.lineWidth = Math.max(1, fontSize * .06);
			context.strokeText(line, lineX, lineY);
		}
		context.fillText(line, lineX, lineY);
		if (styleSet.has('underline')) {
			context.fillRect(
				lineX,
				lineY + fontSize * 1.08,
				context.measureText(line).width,
				Math.max(1, fontSize * .06),
			);
		}
	});
	context.restore();
	return true;
};
