export const createImageDropController = ({
	eventTarget = globalThis.window,
	insertImageBlob,
	onImageImported = () => {},
} = {}) => {
	if (typeof insertImageBlob !== 'function') {
		throw new TypeError('Image drop controller requires an image insertion handler');
	}

	const handleDragOver = (event) => event.preventDefault();
	const handleDrop = async (event) => {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (!file?.type.startsWith('image/')) return;
		const result = await insertImageBlob(file, { sourceLabel: `Dropped ${file.name}` });
		if (result) onImageImported();
	};

	const bind = () => {
		eventTarget.addEventListener('dragover', handleDragOver);
		eventTarget.addEventListener('drop', handleDrop);
	};
	const destroy = () => {
		eventTarget.removeEventListener('dragover', handleDragOver);
		eventTarget.removeEventListener('drop', handleDrop);
	};
	bind();
	return Object.freeze({ destroy, handleDragOver, handleDrop });
};
