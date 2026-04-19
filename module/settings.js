export const MODULE_ID = 'combat-music-master';
import { exportMusicConfig, importMusicConfig } from './transfer.js';

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
});

// Inject Export/Import buttons directly into the settings UI after Pause Tracks.
Hooks.on('renderSettingsConfig', (app, html) => {
	if (!game.user.isGM) return;

	// Find the Pause Tracks setting row — insert our buttons after it.
	const pauseTrackLabel = html instanceof HTMLElement
		? html.querySelector(`[name="${MODULE_ID}.pauseTrack"]`)
		: html.find(`[name="${MODULE_ID}.pauseTrack"]`)[0];
	if (!pauseTrackLabel) return;

	const row = pauseTrackLabel.closest('.form-group') ?? pauseTrackLabel.closest('div');
	if (!row) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'form-group';
	wrapper.innerHTML = `
		<label>Music Config</label>
		<div class="form-fields" style="gap: 0.5rem;">
			<button type="button" id="cmm-export-btn" style="flex:1">
				<i class="fas fa-file-export"></i> Export
			</button>
			<button type="button" id="cmm-import-btn" style="flex:1">
				<i class="fas fa-file-import"></i> Import
			</button>
		</div>
		<p class="hint">Export or import combat playlists and trait rules as a JSON file.</p>
	`;
	row.after(wrapper);

	wrapper.querySelector('#cmm-export-btn').addEventListener('click', () => {
		exportMusicConfig();
	});

	wrapper.querySelector('#cmm-import-btn').addEventListener('click', () => {
		importMusicConfig();
	});
});
