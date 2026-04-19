import { MODULE_ID, getSetting, setSetting } from './settings.js';
import { stringifyMusic, parseMusic } from './music-manager.js';

/* -------------------------------------------- */
/*  Export                                      */
/* -------------------------------------------- */

export async function exportMusicConfig() {
	const combatPlaylists = game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat'));
	const defaultPlaylistId = getSetting('defaultPlaylist');
	const traitRules = getSetting('traitRules') ?? [];

	const playlists = combatPlaylists.map((playlist) => ({
		name: playlist.name,
		default: playlist.id === defaultPlaylistId,
		sounds: playlist.sounds.contents.map((sound) => ({
			name: sound.name,
			path: sound.path,
			volume: sound.volume,
			repeat: sound.repeat,
			streaming: sound.streaming,
		})),
	}));

	// Resolve trait rules to use names instead of IDs so they survive across worlds.
	const resolvedTraitRules = traitRules.map((rule) => {
		const sound = parseMusic(rule.music);
		const playlist = 'error' in sound ? null : sound.parent ?? sound;
		const track = playlist && sound !== playlist ? sound : null;
		return {
			trait: rule.trait,
			priority: rule.priority,
			playlistName: playlist?.name ?? '',
			trackName: track?.name ?? '',
		};
	});

	const data = {
		world: game.world.id,
		version: game.modules.get(MODULE_ID)?.version ?? '?',
		exportedAt: new Date().toISOString(),
		playlists,
		traitRules: resolvedTraitRules,
	};

	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${game.world.id}.music.json`;
	a.click();
	URL.revokeObjectURL(url);
	ui.notifications.info('Combat Music Master | Music config exported.');
}

/* -------------------------------------------- */
/*  Import                                      */
/* -------------------------------------------- */

export async function importMusicConfig() {
	// Open a file picker dialog.
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.addEventListener('change', async (ev) => {
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
	input.click();
}

async function applyImport(data) {
	ui.notifications.info('Combat Music Master | Importing music config...');
	let defaultPlaylistId = '';

	for (const playlistData of data.playlists) {
		// Find or create the playlist by name.
		let playlist = game.playlists.contents.find((p) => p.name === playlistData.name);
		if (!playlist) {
			playlist = await Playlist.create({ name: playlistData.name, mode: -1 });
		}

		// Flag it as a combat playlist.
		await playlist.setFlag(MODULE_ID, 'combat', true);
		if (playlistData.default) defaultPlaylistId = playlist.id;

		// For each sound, find by name or create it.
		for (const soundData of playlistData.sounds) {
			const existing = playlist.sounds.contents.find((s) => s.name === soundData.name);
			if (!existing) {
				await playlist.createEmbeddedDocuments('PlaylistSound', [{
					name: soundData.name,
					path: soundData.path,
					volume: soundData.volume ?? 0.8,
					repeat: soundData.repeat ?? true,
					streaming: soundData.streaming ?? false,
				}]);
			} else {
				// Update path in case it changed.
				await existing.update({ path: soundData.path });
			}
		}
	}

	if (defaultPlaylistId) await setSetting('defaultPlaylist', defaultPlaylistId);

	// Re-resolve trait rules back to music IDs in this world.
	if (data.traitRules?.length) {
		const resolvedRules = data.traitRules.map((rule) => {
			const playlist = game.playlists.contents.find((p) => p.name === rule.playlistName);
			const track = rule.trackName
				? playlist?.sounds.contents.find((s) => s.name === rule.trackName)
				: null;
			const music = track
				? (playlist.id + '.' + track.id)
				: playlist?.id ?? '';
			return {
				trait: rule.trait,
				priority: rule.priority,
				playlistId: playlist?.id ?? '',
				trackId: track?.id ?? '',
				music,
			};
		}).filter((r) => r.music);
		await setSetting('traitRules', resolvedRules);
	}

	ui.notifications.info('Combat Music Master | Import complete!');
}
