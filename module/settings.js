export const MODULE_ID = 'combat-music-master';

const settings = {
	defaultPlaylist: {
		name: 'Default Playlist',
		hint: 'Select the default playlist, otherwise one will be selected at random. Reload to update the list.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	pauseAmbience: {
		name: 'Pause Ambience Sounds',
		hint: 'When combat starts, all ambience sound is paused. It resumes once combat finishes.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	pauseTrack: {
		name: 'Pause Tracks',
		hint: 'When switching tracks, pause old tracks instead of stopping them, unless they are a playlist.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
		requiresReload: true,
	},
	debugLogging: {
		name: 'Debug Logging',
		hint: 'Enable verbose Combat Music Master logs in the browser console.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
};

export function getSetting(name) {
	return game.settings.get(MODULE_ID, name);
}

export function setSetting(name, value) {
	return game.settings.set(MODULE_ID, name, value);
}

export function debugLog(...args) {
	try {
		if (!game?.settings || !game.settings.get(MODULE_ID, 'debugLogging')) return;
		console.log('Combat Music Master |', ...args);
	} catch (_error) {
		// Ignore logging failures during early startup.
	}
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting);
	}
});
