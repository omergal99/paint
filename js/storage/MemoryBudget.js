// Browser memory is not storage quota. Keep this report deliberately honest:
// it measures known application-owned surfaces and labels unknown browser
// internals as estimates instead of presenting quota as RAM availability.

export const DEFAULT_MEMORY_BUDGET = Object.freeze({
	maxUndoBytes: 64 * 1024 * 1024,
	maxDecodedPixels: 32 * 1024 * 1024,
	maxScratchPixels: 16 * 1024 * 1024,
});

export const estimateDataUrlBytes = (dataUrl) => {
	if (typeof dataUrl !== 'string') return 0;
	const comma = dataUrl.indexOf(',');
	const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
	return Math.ceil(payload.replace(/\s/g, '').length * 3 / 4);
}

// Blob.size is the byte count the browser owns for the encoded image. Unlike a
// data URL it does not include base64 expansion or a JavaScript string copy.
// Keep this helper permissive so the report can also be exercised with small
// Blob-like fixtures in non-browser tests.
export const estimateBlobBytes = (blob) => {
	const size = Number(blob?.size);
	return Number.isFinite(size) && size >= 0 ? size : 0;
}

export const estimateHistoryEntryBytes = (entry) => {
	if (!entry || typeof entry !== 'object') return 0;
	// A Blob is canonical once present. Do not count its compatibility object
	// URL/dataUrl alias a second time.
	if (entry.blob && Number.isFinite(Number(entry.blob.size))) {
		return estimateBlobBytes(entry.blob);
	}
	const declared = Number(entry.byteSize);
	if (Number.isFinite(declared) && declared >= 0) return declared;
	if (typeof entry.dataUrl === 'string' && entry.dataUrl.startsWith('blob:')) return 0;
	return estimateDataUrlBytes(entry.dataUrl);
}

const entryHasObjectUrl = (entry) => {
	if (typeof entry?.objectUrl === 'string' && entry.objectUrl) return true;
	return typeof entry?.dataUrl === 'string' && entry.dataUrl.startsWith('blob:');
}

export const summarizeHistoryMemory = (entries = []) => {
	const list = Array.isArray(entries) ? entries : [];
	const blobBytes = list.reduce((total, entry) => total + estimateBlobBytes(entry?.blob), 0);
	const dataUrlBytes = list.reduce((total, entry) => {
		if (entry?.blob && Number.isFinite(Number(entry.blob.size))) return total;
		return total + (typeof entry?.dataUrl === 'string' && entry.dataUrl.startsWith('blob:')
			? 0
			: estimateDataUrlBytes(entry?.dataUrl));
	}, 0);
	const pendingEntryCount = list.reduce((total, entry) => total + (entry?.pending ? 1 : 0), 0);
	return {
		// Kept under the old name for callers/UI that already display it.
		undoBytes: list.reduce((total, entry) => total + estimateHistoryEntryBytes(entry), 0),
		blobBytes,
		dataUrlBytes,
		entryCount: list.length,
		pendingEntryCount,
		objectUrlCount: list.reduce((total, entry) => total + (entryHasObjectUrl(entry) ? 1 : 0), 0),
		decodedPixels: list.reduce((total, entry) => total + ((Number(entry?.width) || 0) * (Number(entry?.height) || 0)), 0),
	};
}

export const makeMemoryReport = ({ historyEntries = [], decodedPixels = 0, scratchPixels = 0, objectUrlCount = 0 } = {}) => {
	const history = summarizeHistoryMemory(historyEntries);
	return {
		...history,
		decodedPixels: Math.max(decodedPixels, history.decodedPixels),
		scratchPixels: Math.max(0, Number(scratchPixels) || 0),
		objectUrlCount: history.objectUrlCount + Math.max(0, Number(objectUrlCount) || 0),
		storageQuotaIsSeparate: true,
	};
}
