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

function getCurrentMusic(combat) {
	return combat._combatMusic || combat.getFlag(MODULE_ID, 'currentMusic') || '';
}

export async function updateCombatMusic(combat, music, token) {
	const oldMusic = getCurrentMusic(combat);
	const oldSound = parseMusic(oldMusic ?? '');
	const sound = parseMusic(music);
	if ('error' in sound) {
		if (sound.error === 'not found') ui.notifications.error(`${sound.rgx[2] ? 'Track' : 'Playlist'} not found.`);
		if (sound.error === 'invalid flag') ui.notifications.error('Bad configuration.');
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
	const sound = parseMusic(getCurrentMusic(combat));
	if (!('error' in sound)) {
		if (sound.documentName === 'Playlist') sound.stopAll();
		else sound.update({ playing: false, pausedTime: null });
	}
	combat._combatMusic = '';
	combat.unsetFlag(MODULE_ID, 'encounterInterrupted');
	for (const sound of paused) sound.update({ playing: true });
	paused = [];
}

export function parseMusic(flag) {
	const rgx = /(\w+)\.?(\w+)?/.exec(flag);
	if (!rgx) return { error: 'invalid flag' };
	const playlist = game.playlists.get(rgx[1]),
		sound = playlist?.sounds.get(rgx[2]);
	return sound ?? playlist ?? { error: 'not found', rgx };
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

export async function updateTurnMusic(combat) {
	if (!combat.started || getCombatMusic().length === 0) return;
	const overrideMusic = combat.getFlag(MODULE_ID, 'overrideMusic');

	if (overrideMusic) {
		// An encounter track is set — check if the current combatant has token-specific music.
		const combatantToken = combat.combatant?.token ?? null;
		const tokenMusic = combatantToken ? getTokenMusic(combatantToken) : null;

		if (tokenMusic) {
			// This combatant has their own music. Pause the encounter track (if it isn't
			// already paused for this reason) and play the token's music instead.
			const encounterSound = parseMusic(overrideMusic);
			if (!('error' in encounterSound)) {
				const alreadyInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
				if (!alreadyInterrupted) {
					// Mark that we've interrupted the encounter track so we know to resume it.
					combat.setFlag(MODULE_ID, 'encounterInterrupted', true);
					// Pause the encounter track rather than stopping it so it resumes from the same point.
					if (encounterSound.documentName === 'PlaylistSound') {
						pause(encounterSound);
					} else {
						// It's a whole playlist — pause every playing sound in it.
						encounterSound.sounds.contents
							.filter((s) => s.playing)
							.forEach((s) => pause(s));
					}
				}
			}
			// Play the token's music.
			updateCombatMusic(combat, tokenMusic, combatantToken.id);
		} else {
			// No token music for this combatant. If the encounter track was interrupted, resume it.
			const wasInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
			if (wasInterrupted) {
				combat.setFlag(MODULE_ID, 'encounterInterrupted', false);
				// Stop whatever token music is currently playing.
				const currentMusic = getCurrentMusic(combat);
				if (currentMusic) {
					const currentSound = parseMusic(currentMusic);
					if (!('error' in currentSound)) {
						if (currentSound.documentName === 'PlaylistSound') await currentSound.parent.stopSound(currentSound);
						else await currentSound.stopAll();
					}
				}
				// Resume the encounter track.
				const encounterSound = parseMusic(overrideMusic);
				if (!('error' in encounterSound)) {
					if (encounterSound.documentName === 'PlaylistSound') resume(encounterSound);
					else {
						// Resume each sound in the playlist that we had paused.
						encounterSound.sounds.contents
							.filter((s) => combatPaused.includes(s))
							.forEach((s) => resume(s));
					}
				}
				combat._combatMusic = overrideMusic;
				setCombatMusic(encounterSound, combat, '');
			} else {
				// Normal case — just play the encounter track.
				updateCombatMusic(combat, overrideMusic, '');
			}
		}
		return;
	}

	// No encounter override — use the priority system.
	let music = '';
	let token = '';
	const highestPriority = getHighestPriority(createPriorityList(combat.combatant?.tokenId));
	const musicFound = highestPriority.find((p) => p.music === music);
	if (!musicFound) {
		const sorted = pick(highestPriority);
		token = sorted.token;
		music = sorted.music;
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
