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
	traitRules: {
		name: 'Trait Music Rules',
		scope: 'world',
		config: false,
		type: Array,
		default: [],
	},
	traitMappings: {
		name: 'Trait Music Mappings',
		scope: 'world',
		config: false,
		type: String,
		default: '[]',
	},
};

export function getSetting(name) {
	return game.settings.get(MODULE_ID, name);
}

export function setSetting(name, value) {
	return game.settings.set(MODULE_ID, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting);
	}

	game.settings.registerMenu(MODULE_ID, 'exportMusic', {
		name: 'Export Music Config',
		label: 'Export',
		hint: 'Download a JSON of all combat playlists, their tracks, and trait rules.',
		icon: 'fas fa-file-export',
		restricted: true,
		type: class extends foundry.applications.api.ApplicationV2 {
			static DEFAULT_OPTIONS = { id: 'cmm-export' };
			async _renderHTML() {}
			async _replaceHTML() {
				const { exportMusicConfig } = await import('./transfer.js');
				await exportMusicConfig();
				this.close();
			}
		},
	});

	game.settings.registerMenu(MODULE_ID, 'importMusic', {
		name: 'Import Music Config',
		label: 'Import',
		hint: 'Load a previously exported music config JSON into this world.',
		icon: 'fas fa-file-import',
		restricted: true,
		type: class extends foundry.applications.api.ApplicationV2 {
			static DEFAULT_OPTIONS = { id: 'cmm-import' };
			async _renderHTML() {}
			async _replaceHTML() {
				const { importMusicConfig } = await import('./transfer.js');
				await importMusicConfig();
				this.close();
			}
		},
	});
});
