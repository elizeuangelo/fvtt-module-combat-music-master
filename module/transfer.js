import { MODULE_ID } from './constants.js';
import { getSetting, setSetting } from './settings.js';

/* -------------------------------------------- */
/*  Export                                      */
/* -------------------------------------------- */

export async function exportMusicConfig() {
	const combatPlaylists = game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat'));
	const defaultPlaylistId = getSetting('defaultPlaylist');

	const playlists = combatPlaylists.map((playlist) => ({
		name: playlist.name,
		default: playlist.id === defaultPlaylistId,
		mode: playlist.mode,
		sounds: playlist.sounds.contents.map((sound) => ({
			name: sound.name,
			path: sound.path,
			volume: sound.volume,
			repeat: sound.repeat,
			streaming: sound.streaming,
		})),
	}));

	const data = {
		world: game.world.id,
		version: game.modules.get(MODULE_ID)?.version ?? '?',
		exportedAt: new Date().toISOString(),
		playlists,
	};

	Hooks.call('CMMExport', data);

	const json = JSON.stringify(data, null, 2);
	saveDataToFile(json, 'application/json', `${game.world.id}.music.json`);
	ui.notifications.info('Combat Music Master | Music config exported.');
}

/* -------------------------------------------- */
/*  Import                                      */
/* -------------------------------------------- */

export function importMusicConfig() {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.style.display = 'none';
	document.body.appendChild(input);

	input.addEventListener('change', async (ev) => {
		document.body.removeChild(input);
		// @ts-ignore
		const file = ev.target.files[0];
		if (!file) return;
		const text = await file.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			ui.notifications.error('Combat Music Master | Invalid JSON file.');
			return;
		}
		if (!data.playlists || !Array.isArray(data.playlists)) {
			ui.notifications.error('Combat Music Master | Not a valid music export file.');
			return;
		}
		await applyImport(data);
	});

	// Clean up if user cancels without selecting a file.
	input.addEventListener('cancel', () => {
		document.body.removeChild(input);
	});

	input.click();
}

async function applyImport(data) {
	ui.notifications.info('Combat Music Master | Importing music config...');
	let defaultPlaylistId = '';

	// Build a name→playlist map as we go so trait resolution sees newly created playlists.
	const playlistMap = new Map();

	for (const playlistData of data.playlists) {
		let playlist = game.playlists.contents.find((p) => p.name === playlistData.name);
		if (!playlist) {
			playlist = await Playlist.create({ name: playlistData.name, mode: playlistData.mode ?? -1 });
		} else {
			await playlist.update({ mode: playlistData.mode ?? playlist.mode });
		}

		await playlist.setFlag(MODULE_ID, 'combat', true);
		if (playlistData.default) defaultPlaylistId = playlist.id;
		playlistMap.set(playlistData.name, playlist);

		for (const soundData of playlistData.sounds) {
			const existing = playlist.sounds.contents.find((s) => s.name === soundData.name);
			if (!existing) {
				await playlist.createEmbeddedDocuments('PlaylistSound', [
					{
						name: soundData.name,
						path: soundData.path,
						volume: soundData.volume ?? 0.8,
						repeat: soundData.repeat ?? true,
						streaming: soundData.streaming ?? false,
					},
				]);
			} else {
				await existing.update({ path: soundData.path });
			}
		}
	}

	if (defaultPlaylistId) await setSetting('defaultPlaylist', defaultPlaylistId);
	Hooks.call('CMMImport', data, playlistMap);
	ui.notifications.info('Combat Music Master | Import complete!');
}
