export const LASSO_MIN_POINT_DISTANCE = 1.5;
export const LASSO_MAX_POINTS = 2000;
const REDUCED_POINT_TARGET = Math.floor(LASSO_MAX_POINTS / 2);

const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const perpendicularDistance = (point, start, end) => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return Math.sqrt(squaredDistance(point, start));
	const projection = Math.max(0, Math.min(1,
		((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
};

const simplifyPath = (points, tolerance) => {
	if (points.length <= 2) return points;
	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	const ranges = [[0, points.length - 1]];
	while (ranges.length) {
		const [start, end] = ranges.pop();
		let maxDistance = tolerance;
		let farthest = -1;
		for (let index = start + 1; index < end; index++) {
			const distance = perpendicularDistance(points[index], points[start], points[end]);
			if (distance > maxDistance) {
				maxDistance = distance;
				farthest = index;
			}
		}
		if (farthest >= 0) {
			keep[farthest] = 1;
			ranges.push([start, farthest], [farthest, end]);
		}
	}
	return points.filter((_, index) => keep[index]);
};

const samplePath = (points, count) => {
	if (points.length <= count) return points;
	const sampled = [];
	const last = points.length - 1;
	for (let index = 0; index < count; index++) {
		sampled.push(points[Math.round(index * last / (count - 1))]);
	}
	return sampled;
};

export const appendLassoPoint = (
	points,
	point,
	{ minDistance = LASSO_MIN_POINT_DISTANCE, maxPoints = LASSO_MAX_POINTS } = {},
) => {
	const previous = points.at(-1);
	if (previous && squaredDistance(previous, point) < minDistance * minDistance) return points;
	points.push({ x: Number(point.x), y: Number(point.y) });
	if (points.length <= maxPoints) return points;

	let tolerance = Math.max(minDistance, 0.5);
	let simplified = simplifyPath(points, tolerance);
	while (simplified.length > Math.floor(maxPoints * 0.75)) {
		tolerance *= 2;
		simplified = simplifyPath(points, tolerance);
	}
	points.splice(0, points.length, ...samplePath(simplified, Math.min(maxPoints, REDUCED_POINT_TARGET)));
	return points;
};

export const getPathBounds = (path = []) => {
	if (path.length < 3) return null;
	const xs = path.map(({ x }) => Number(x));
	const ys = path.map(({ y }) => Number(y));
	const x = Math.floor(Math.min(...xs));
	const y = Math.floor(Math.min(...ys));
	const right = Math.ceil(Math.max(...xs));
	const bottom = Math.ceil(Math.max(...ys));
	if (right <= x || bottom <= y) return null;
	return { x, y, w: right - x, h: bottom - y };
};

export const isPointInPath = (point, path = []) => {
	if (path.length < 3) return false;
	let inside = false;
	for (let index = 0, previous = path.length - 1; index < path.length; previous = index++) {
		const a = path[index];
		const b = path[previous];
		const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
		const withinSegment = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y) <= 1e-8;
		if (Math.abs(cross) <= 1e-6 && withinSegment) return true;
		const crosses = (a.y > point.y) !== (b.y > point.y)
			&& point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
		if (crosses) inside = !inside;
	}
	return inside;
};

export const translatePath = (path, dx, dy) => (
	Array.isArray(path) ? path.map(({ x, y }) => ({ x: x + dx, y: y + dy })) : undefined
);

export const fitPathToBounds = (path, originalBounds, nextBounds) => {
	if (!Array.isArray(path) || !originalBounds?.w || !originalBounds?.h) return undefined;
	const scaleX = nextBounds.w / originalBounds.w;
	const scaleY = nextBounds.h / originalBounds.h;
	return path.map(({ x, y }) => ({
		x: nextBounds.x + (x - originalBounds.x) * scaleX,
		y: nextBounds.y + (y - originalBounds.y) * scaleY,
	}));
};

export const rotatePathToBounds = (path, originalBounds, nextBounds, degrees) => {
	if (!Array.isArray(path) || !originalBounds?.w || !originalBounds?.h) return undefined;
	const radians = degrees * Math.PI / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const sourceCenter = { x: originalBounds.x + originalBounds.w / 2, y: originalBounds.y + originalBounds.h / 2 };
	const targetCenter = { x: nextBounds.x + nextBounds.w / 2, y: nextBounds.y + nextBounds.h / 2 };
	return path.map(({ x, y }) => {
		const dx = x - sourceCenter.x;
		const dy = y - sourceCenter.y;
		return {
			x: targetCenter.x + dx * cos - dy * sin,
			y: targetCenter.y + dx * sin + dy * cos,
		};
	});
};

export const flipPathInBounds = (path, bounds, horizontal) => {
	if (!Array.isArray(path)) return undefined;
	return path.map(({ x, y }) => ({
		x: horizontal ? bounds.x + bounds.w - (x - bounds.x) : x,
		y: horizontal ? y : bounds.y + bounds.h - (y - bounds.y),
	}));
};

export const traceSelectionPath = (context, region) => {
	if (!context || !Array.isArray(region?.path) || region.path.length < 3) return false;
	context.beginPath();
	context.moveTo(region.path[0].x, region.path[0].y);
	for (let index = 1; index < region.path.length; index++) {
		context.lineTo(region.path[index].x, region.path[index].y);
	}
	context.closePath();
	return true;
};
