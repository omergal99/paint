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

export const summarizeHistoryMemory = (entries = []) => {
	const list = Array.isArray(entries) ? entries : [];
	const undoBytes = list.reduce((total, entry) => total + estimateDataUrlBytes(entry?.dataUrl), 0);
	return {
		undoBytes,
		entryCount: list.length,
		decodedPixels: list.reduce((total, entry) => total + ((Number(entry?.width) || 0) * (Number(entry?.height) || 0)), 0),
	};
}

export const makeMemoryReport = ({ historyEntries = [], decodedPixels = 0, scratchPixels = 0, objectUrlCount = 0 } = {}) => {
	return {
		...summarizeHistoryMemory(historyEntries),
		decodedPixels: Math.max(decodedPixels, summarizeHistoryMemory(historyEntries).decodedPixels),
		scratchPixels: Math.max(0, Number(scratchPixels) || 0),
		objectUrlCount: Math.max(0, Number(objectUrlCount) || 0),
		storageQuotaIsSeparate: true,
	};
}
