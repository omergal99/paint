// Locale-independent date rendering. `22/Sep/2026` stays unambiguous no matter
// which interface language is active, unlike numeric day/month ordering that
// changes meaning between locales (22/09 vs 09/22).
const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const pad2 = (value) => String(value).padStart(2, '0');
const isValid = (date) => date instanceof Date && !Number.isNaN(date.getTime());

export const formatUnambiguousDate = (date) => {
	if (!isValid(date)) return '';
	return `${date.getDate()}/${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
};

export const formatUnambiguousTime = (date) => {
	if (!isValid(date)) return '';
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const formatUnambiguousDateTime = (date) => {
	if (!isValid(date)) return '';
	return `${formatUnambiguousDate(date)}, ${formatUnambiguousTime(date)}`;
};
