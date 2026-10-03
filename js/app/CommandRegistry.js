export const createCommandRegistry = ({ commands = {} } = {}) => {
	const commandMap = Object.freeze({ ...commands });

	const execute = ({ action, ...context } = {}) => {
		const command = commandMap[action];
		if (typeof command !== 'function') return false;
		return command(context);
	};

	const has = (action) => typeof commandMap[action] === 'function';

	return Object.freeze({ execute, has });
};
