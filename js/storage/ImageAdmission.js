// Pure decoded-image admission checks. Callers calculate a final target canvas
// size for placement, then use this result before allocating or mutating it.

import { LIMITS } from '../core/constants.js';

export const IMAGE_ADMISSION_REASONS = Object.freeze({
	invalidDimensions: 'invalid-dimensions',
	sourceDimensionLimit: 'source-dimension-limit',
	sourcePixelLimit: 'source-pixel-limit',
	targetDimensionLimit: 'target-dimension-limit',
	targetPixelLimit: 'target-pixel-limit',
});

const isPositivePixelDimension = (value) => Number.isSafeInteger(value) && value > 0;

const result = ({ ok, reason = null, message = '', width, height, targetWidth = null, targetHeight = null }) => ({
	ok,
	reason,
	message,
	width: Number.isSafeInteger(width) ? width : null,
	height: Number.isSafeInteger(height) ? height : null,
	targetWidth: Number.isSafeInteger(targetWidth) ? targetWidth : null,
	targetHeight: Number.isSafeInteger(targetHeight) ? targetHeight : null,
});

const exceedsDimensionLimit = (width, height) => width > LIMITS.maxCanvasDimension || height > LIMITS.maxCanvasDimension;

const exceedsPixelLimit = (width, height) => width * height > LIMITS.maxImportPixels;

/**
 * Validates decoded source dimensions and, when supplied, the final canvas
 * dimensions that an import or paste would require. Both target dimensions
 * must be supplied together.
 */
export const assessImageAdmission = ({ width, height, targetWidth, targetHeight } = {}) => {
	const hasTarget = targetWidth !== undefined || targetHeight !== undefined;
	const values = { width, height, targetWidth, targetHeight };
	if (!isPositivePixelDimension(width) || !isPositivePixelDimension(height)) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.invalidDimensions,
			message: 'Image dimensions must be positive whole pixels.',
		});
	}
	if (exceedsDimensionLimit(width, height)) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.sourceDimensionLimit,
			message: `Image is wider or taller than the ${LIMITS.maxCanvasDimension}px limit.`,
		});
	}
	if (exceedsPixelLimit(width, height)) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.sourcePixelLimit,
			message: `Image exceeds the ${LIMITS.maxImportPixels}-pixel limit.`,
		});
	}
	if (hasTarget && (!isPositivePixelDimension(targetWidth) || !isPositivePixelDimension(targetHeight))) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.invalidDimensions,
			message: 'Target canvas dimensions must be positive whole pixels.',
		});
	}
	if (hasTarget && exceedsDimensionLimit(targetWidth, targetHeight)) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.targetDimensionLimit,
			message: `Image placement would exceed the ${LIMITS.maxCanvasDimension}px canvas limit.`,
		});
	}
	if (hasTarget && exceedsPixelLimit(targetWidth, targetHeight)) {
		return result({
			...values,
			ok: false,
			reason: IMAGE_ADMISSION_REASONS.targetPixelLimit,
			message: `Image placement would exceed the ${LIMITS.maxImportPixels}-pixel canvas limit.`,
		});
	}
	return result({ ...values, ok: true });
};
