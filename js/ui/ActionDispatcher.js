const ACTION_SELECTOR = '[data-action]';

export const createActionDispatcher = ({
	commandRegistry,
	root = globalThis.document?.body,
} = {}) => {
	let isBound = false;

	const handleClick = (event) => {
		const actionElement = event.target?.closest?.(ACTION_SELECTOR);
		if (!actionElement || !root?.contains?.(actionElement)
			|| actionElement.disabled
			|| actionElement.getAttribute?.('aria-disabled') === 'true') return;

		const { action } = actionElement.dataset || {};
		if (!action || !commandRegistry?.has(action)) return;
		commandRegistry.execute({ action, event });
	};

	const bind = () => {
		if (isBound || !root?.addEventListener) return;
		root.addEventListener('click', handleClick);
		isBound = true;
	};

	const destroy = () => {
		if (!isBound) return;
		root.removeEventListener('click', handleClick);
		isBound = false;
	};

	return Object.freeze({ bind, destroy });
};
