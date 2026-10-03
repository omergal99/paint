export const createAdjustmentMaskTool = ({ mask, getSelection } = {}) => {
	let previousPoint = null;
	let drawing = false;
	let erase = false;
	let preserveMaskOnDeactivate = false;

	const getRegion = () => getSelection?.() || null;
	const paint = (point, ctx) => {
		if (!previousPoint) {
			previousPoint = point;
			mask.stroke({
				from: point,
				to: point,
				size: ctx.canvasManager.lineWidth,
				erase,
				region: getRegion(),
			});
			return;
		}
		mask.stroke({
			from: previousPoint,
			to: point,
			size: ctx.canvasManager.lineWidth,
			erase,
			region: getRegion(),
		});
		previousPoint = point;
	};

	return Object.freeze({
		name: 'adjustment-mask',
		cursor: 'crosshair',
		preserveMaskOnDeactivate() {
			preserveMaskOnDeactivate = true;
		},
		onDown(point, ctx) {
			previousPoint = null;
			drawing = true;
			erase = point.button === 2;
			paint(point, ctx);
		},
		onMove(point, ctx) {
			if (!drawing) return;
			paint(point, ctx);
		},
		onUp() {
			previousPoint = null;
			drawing = false;
		},
		onCancel() {
			previousPoint = null;
			drawing = false;
		},
		onDeactivate() {
			previousPoint = null;
			drawing = false;
			if (preserveMaskOnDeactivate) {
				preserveMaskOnDeactivate = false;
				return;
			}
			mask.clear();
		},
	});
};
