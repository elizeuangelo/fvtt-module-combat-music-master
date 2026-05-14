import { getSetting, MODULE_ID } from './settings.js';
import { getTokenMusic } from './token.js';

function playCombatMusic() {
	if (getCombatMusic().length === 0) return;
	if (getSetting('pauseAmbience')) pauseAllMusic();
}

let combatPaused = [];

async function pause(sound) {
	combatPaused.push(sound);
	sound.update({ playing: false, pausedTime: sound.sound.currentTime });
}

async function resume(sound) {
	sound.update({ playing: true });
	const idx = combatPaused.indexOf(sound);
	if (idx === -1) return;
	combatPaused.splice(idx, 1);
}

export async function updateCombatMusic(combat, music, token) {
	const oldMusic = combat._combatMusic;
	const oldSound = parseMusic(oldMusic ?? '');
	const sound = parseMusic(music);
	if ('error' in sound) {
		if (sound.error === 'empty') return;
		notifyParseError(sound);
		return;
	}
	if (oldMusic !== music) {
		if (!('error' in oldSound)) {
			if (getSetting('pauseTrack') && oldSound.documentName === 'PlaylistSound') await pause(oldSound);
			else {
				if (oldSound.documentName === 'PlaylistSound') await oldSound.parent.stopSound(oldSound);
				else await oldSound.stopAll();
			}
		}
		if (getSetting('pauseTrack') && sound.documentName === 'PlaylistSound') resume(sound);
		else {
			if (sound.documentName === 'PlaylistSound') sound.parent.playSound(sound);
			else sound.playAll();
		}
	}
	combat._combatMusic = music;
	setCombatMusic(sound, combat, token);
}

function createPriorityList(tokenId) {
	const base = getSetting('defaultPlaylist');
	const combatPlaylists = new Map(getCombatMusic().map((p) => [{ token: '', music: p.id }, +(p.id === base)]));
	for (const combatant of game.combat.combatants.contents) {
		if (!combatant.token) continue;
		const music = getTokenMusic(combatant.token),
			priority = combatant.token.getFlag(MODULE_ID, 'priority') ?? 10,
			token = combatant.token.id;
		if (music && (combatant.token.getFlag(MODULE_ID, 'turnOnly') === false || token === tokenId))
			combatPlaylists.set({ token, music }, priority);
	}
	return combatPlaylists;
}

export function getHighestPriority(map) {
	const max = Math.max(...map.values());
	return [...map].filter(([p, v]) => v === max).map(([p, v]) => p);
}

export function pick(array) {
	return array[~~(Math.random() * array.length)];
}

let paused = [];

function pauseAllMusic() {
	paused = game.playlists.playing.map((p) => p.sounds.contents.filter((p) => p.playing)).flat();
	for (const sound of paused) sound.update({ playing: false, pausedTime: sound.sound.currentTime });
}

function resumePlaylists(combat) {
	combatPaused.forEach((sound) => {
		if (!paused.includes(sound)) sound.update({ playing: false, pausedTime: null });
	});
	combatPaused = [];
	const sound = parseMusic(combat._combatMusic);
	if (!('error' in sound)) {
		if (sound.documentName === 'Playlist') sound.stopAll();
		else sound.update({ playing: false, pausedTime: null });
	}
	combat._combatMusic = '';
	for (const sound of paused) sound.update({ playing: true });
	paused = [];
}

export function parseMusic(flag) {
	if (!flag) return { error: 'empty', flag };
	const match = /^([A-Za-z0-9_-]+)(?:\\.([A-Za-z0-9_-]+))?$/.exec(flag.trim());
	if (!match) return { error: 'invalid flag', flag };
	const [, playlistId, trackId] = match;
	const playlist = game.playlists.get(playlistId);
	if (!playlist) return { error: 'missing playlist', flag, playlistId, trackId };
	if (!trackId) return playlist;
	const sound = playlist.sounds.get(trackId);
	return sound ?? { error: 'missing track', flag, playlistId, trackId };
}

export function notifyParseError(parsed) {
	if (!parsed || !('error' in parsed)) return;
	switch (parsed.error) {
		case 'empty': break; // No music configured — not an error, just nothing to do.
		case 'invalid flag':
			ui.notifications.error(`Combat Music Master: Invalid music reference \"${parsed.flag}\".`);
			break;
		case 'missing playlist':
			ui.notifications.error(`Combat Music Master: Playlist \"${parsed.playlistId}\" not found.`);
			break;
		case 'missing track':
			ui.notifications.error(
				`Combat Music Master: Track \"${parsed.trackId}\" not found in playlist \"${parsed.playlistId}\".`
			);
			break;
	}
}

export function stringifyMusic(sound) {
	return (sound?.parent ? sound.parent.id + '.' + sound.id : sound?.id) ?? '';
}

export function setCombatMusic(sound, combat = game.combat, token) {
	if (combat) {
		combat.update({
			[`flags.${MODULE_ID}`]: {
				currentMusic: stringifyMusic(sound),
				token,
			},
		});
	}
}

export function setTokenConfig(token, resource, sounds, priority = 10, turnOnly = false, active = false) {
	sounds = (sounds ?? []).sort((a, b) => b[1] - a[1]);
	token.setFlag(MODULE_ID, {
		active,
		resource,
		priority,
		musicList: sounds.map(([sound, threshold]) => [stringifyMusic(sound), threshold]),
		turnOnly,
	});
}

export function getCombatMusic() {
	return game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat'));
}

export function updateTurnMusic(combat) {
	if (!combat.started || getCombatMusic().length === 0) return;
	let music = combat.getFlag(MODULE_ID, 'overrideMusic');
	let token = '';
	if (!music) {
		const highestPriority = getHighestPriority(createPriorityList(combat.combatant?.tokenId));
		const musicFound = highestPriority.find((p) => p.music === music);
		if (!musicFound) {
			const sorted = pick(highestPriority);
			token = sorted.token;
			music = sorted.music;
		}
	}
	if (music) updateCombatMusic(combat, music, token);
}

window.CombatMusicMaster = {
	setCombatMusic,
	setTokenConfig,
};

Hooks.once('setup', () => {
	if (game.user.isGM) {
		Hooks.on('combatStart', playCombatMusic);
		Hooks.on('updateCombat', updateTurnMusic);
		Hooks.on('deleteCombat', resumePlaylists);
	}
});
