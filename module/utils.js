export function debounce(fn, delay = 100) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

/**
 * @template T
 * @param {T} data
 * @returns {{ ok: true, data: T, error?: undefined, message?: undefined }}
 */
export function Ok(data) {
	return { ok: true, data };
}

/**
 * @template D
 * @param {string} error
 * @param {string} [message]
 * @returns {{ ok: false, error: string, message: string, data?: undefined }}
 */
export function Err(error, message) {
	return { ok: false, error, message };
}
