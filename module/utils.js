import { MODULE_ID } from './constants.js';

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
 * @param {string} error
 * @param {string} [message]
 * @returns {{ ok: false, error: string, message: string, data?: undefined }}
 */
export function Err(error, message) {
	return { ok: false, error, message };
}

export function debugLog(...args) {
	if (!globalThis.game?.settings) return;

	try {
		if (!game.settings.get(MODULE_ID, 'debugLogging')) return;
		console.log('Combat Music Master |', ...args);
	} catch (_error) {
		// Ignore settings access failures during early startup.
	}
}
