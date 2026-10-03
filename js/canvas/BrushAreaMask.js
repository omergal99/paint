const createCanvas = (width, height, documentRef) => {
	const canvas = documentRef.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Brush-area mask requires a 2D canvas context');
	return { canvas, context };
};

const traceRegion = (context, region) => {
	context.beginPath();
	if (Array.isArray(region?.path) && region.path.length >= 3) {
		context.moveTo(region.path[0].x, region.path[0].y);
		region.path.slice(1).forEach((point) => context.lineTo(point.x, point.y));
		context.closePath();
	} else if (region?.w > 0 && region?.h > 0) {
		context.rect(region.x, region.y, region.w, region.h);
	} else {
		context.rect(0, 0, context.canvas.width, context.canvas.height);
	}
};

export const createBrushAreaMask = ({
	width,
	height,
	documentRef = globalThis.document,
	previewCanvas,
} = {}) => {
	if (!documentRef?.createElement || !previewCanvas) {
		throw new TypeError('Brush-area mask requires a document and preview canvas');
	}
	let { canvas: maskCanvas, context: maskContext } = createCanvas(width, height, documentRef);
	const previewContext = previewCanvas.getContext('2d');
	if (!previewContext) throw new Error('Brush-area preview has no 2D context');

	const render = () => {
		previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		if (!maskCanvas.width || !maskCanvas.height) return;
		previewContext.save();
		previewContext.fillStyle = 'rgba(156, 163, 175, 0.3)';
		previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
		previewContext.globalCompositeOperation = 'destination-in';
		previewContext.drawImage(maskCanvas, 0, 0);
		previewContext.restore();
	};

	const resize = (nextWidth, nextHeight) => {
		if (nextWidth === maskCanvas.width && nextHeight === maskCanvas.height) return false;
		const snapshot = createCanvas(maskCanvas.width, maskCanvas.height, documentRef);
		snapshot.context.drawImage(maskCanvas, 0, 0);
		maskCanvas.width = nextWidth;
		maskCanvas.height = nextHeight;
		previewCanvas.width = nextWidth;
		previewCanvas.height = nextHeight;
		maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
		if (!maskContext) throw new Error('Unable to resize brush-area mask');
		maskContext.drawImage(snapshot.canvas, 0, 0);
		render();
		return true;
	};

	const stroke = ({ from, to, size = 1, erase = false, region = null } = {}) => {
		if (!from || !to) throw new TypeError('A brush-area stroke requires start and end points');
		maskContext.save();
		traceRegion(maskContext, region);
		maskContext.clip();
		maskContext.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
		maskContext.strokeStyle = '#fff';
		maskContext.lineWidth = Math.max(1, Number(size) || 1);
		maskContext.lineCap = 'round';
		maskContext.lineJoin = 'round';
		maskContext.beginPath();
		maskContext.moveTo(from.x, from.y);
		maskContext.lineTo(to.x, to.y);
		maskContext.stroke();
		maskContext.restore();
		render();
	};

	const clear = () => {
		maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
		render();
	};

	const invert = (region = null) => {
		const inverted = createCanvas(maskCanvas.width, maskCanvas.height, documentRef);
		traceRegion(inverted.context, region);
		inverted.context.clip();
		inverted.context.fillStyle = '#fff';
		inverted.context.fillRect(0, 0, inverted.canvas.width, inverted.canvas.height);
		inverted.context.globalCompositeOperation = 'destination-out';
		inverted.context.drawImage(maskCanvas, 0, 0);
		maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
		maskContext.drawImage(inverted.canvas, 0, 0);
		render();
	};

	const composite = (source, adjusted, { maskSource = maskCanvas } = {}) => {
		if (source.width !== adjusted.width || source.height !== adjusted.height
			|| source.width !== maskSource.width || source.height !== maskSource.height) {
			throw new RangeError('Source, adjusted image, and mask dimensions must match');
		}
		const output = createCanvas(source.width, source.height, documentRef);
		output.context.drawImage(source, 0, 0);
		const maxBandPixels = 1024 * 1024;
		const bandHeight = Math.max(1, Math.floor(maxBandPixels / source.width));
		const adjustedContext = adjusted.getContext('2d', { willReadFrequently: true });
		const sourceMaskContext = maskSource.getContext('2d', { willReadFrequently: true });
		if (!adjustedContext || !sourceMaskContext) throw new Error('Unable to read adjustment composite sources');
		for (let y = 0; y < source.height; y += bandHeight) {
			const rows = Math.min(bandHeight, source.height - y);
			const base = output.context.getImageData(0, y, source.width, rows);
			const changed = adjustedContext.getImageData(0, y, source.width, rows);
			const mask = sourceMaskContext.getImageData(0, y, source.width, rows);
			for (let index = 0; index < base.data.length; index += 4) {
				const amount = mask.data[index + 3] / 255;
				for (let channel = 0; channel < 4; channel += 1) {
					base.data[index + channel] = Math.round(
						base.data[index + channel] * (1 - amount) + changed.data[index + channel] * amount,
					);
				}
			}
			output.context.putImageData(base, 0, y);
		}
		return output.canvas;
	};

	const destroy = () => {
		clear();
	};

	return Object.freeze({
		getCanvas: () => maskCanvas,
		resize,
		stroke,
		clear,
		invert,
		render,
		composite,
		hasContent: () => {
			const rowsPerBand = Math.max(1, Math.floor((1024 * 1024) / maskCanvas.width));
			for (let y = 0; y < maskCanvas.height; y += rowsPerBand) {
				const rows = Math.min(rowsPerBand, maskCanvas.height - y);
				const { data } = maskContext.getImageData(0, y, maskCanvas.width, rows);
				for (let index = 3; index < data.length; index += 4) {
					if (data[index] > 0) return true;
				}
			}
			return false;
		},
		destroy,
	});
};
