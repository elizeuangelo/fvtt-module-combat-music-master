import { getSetting, MODULE_ID } from './settings.js';
import { getTokenMusic } from './token.js';

async function playCombatMusic(combat) {
	if (getCombatMusic().length === 0) return;
	if (getSetting('pauseAmbience')) pauseAllMusic();
	await updateTurnMusic(combat);
}

let combatPaused = [];

async function pause(sound) {
	if (combatPaused.includes(sound)) return;
	combatPaused.push(sound);
	const currentTime = sound.sound?.currentTime ?? null;
	await sound.update({ playing: false, pausedTime: currentTime });
}

async function resume(sound) {
	await sound.update({ playing: true });
	const idx = combatPaused.indexOf(sound);
	if (idx !== -1) combatPaused.splice(idx, 1);
}

async function pauseEncounterTrack(combat, musicFlag) {
	const sound = parseMusic(musicFlag);
	if ('error' in sound) return;
	const toResume = [];
	if (sound.documentName === 'PlaylistSound') {
		await pause(sound);
		toResume.push(sound.id);
	} else {
		for (const s of sound.sounds.contents.filter((s) => s.playing)) {
			await pause(s);
			toResume.push(s.id);
		}
	}
	// Persist which sounds were paused so we can resume exactly those.
	await combat.setFlag(MODULE_ID, 'pausedSounds', toResume);
}

async function resumeEncounterTrack(combat, musicFlag) {
	const sound = parseMusic(musicFlag);
	if ('error' in sound) return;
	const pausedIds = combat.getFlag(MODULE_ID, 'pausedSounds') ?? [];
	const candidates = sound.documentName === 'PlaylistSound'
		? [sound]
		: sound.sounds.contents;
	for (const s of candidates) {
		if (pausedIds.includes(s.id)) await resume(s);
	}
	await combat.unsetFlag(MODULE_ID, 'pausedSounds');
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
	const combatPlaylistIds = new Set(getCombatMusic().map((p) => p.id));
	paused = game.playlists.playing
		.filter((p) => !combatPlaylistIds.has(p.id))
		.map((p) => p.sounds.contents.filter((s) => s.playing))
		.flat();
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
	combat.unsetFlag(MODULE_ID, 'pausedSounds');
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
			const alreadyInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
			if (!alreadyInterrupted) {
				combat.setFlag(MODULE_ID, 'encounterInterrupted', true);
				await pauseEncounterTrack(combat, overrideMusic);
			}
			updateCombatMusic(combat, tokenMusic, combatantToken.id);
		} else {
			const wasInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
			if (wasInterrupted) {
				combat.setFlag(MODULE_ID, 'encounterInterrupted', false);
				const currentMusic = getCurrentMusic(combat);
				if (currentMusic) {
					const currentSound = parseMusic(currentMusic);
					if (!('error' in currentSound)) {
						if (currentSound.documentName === 'PlaylistSound') await currentSound.parent.stopSound(currentSound);
						else await currentSound.stopAll();
					}
				}
				await resumeEncounterTrack(combat, overrideMusic);
				combat._combatMusic = overrideMusic;
				setCombatMusic(parseMusic(overrideMusic), combat, '');
			} else {
				updateCombatMusic(combat, overrideMusic, '');
			}
		}
		return;
	}

	// No encounter override — check if the current combatant has personal turn music
	// that should interrupt whatever is playing (Combat Theme or trait music).
	const combatantToken = combat.combatant?.token ?? null;
	const turnMusic = combatantToken ? getTokenMusic(combatantToken) : null;
	if (turnMusic) {
		const currentMusic = getCurrentMusic(combat);
		const alreadyInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
		if (!alreadyInterrupted && currentMusic) {
			combat.setFlag(MODULE_ID, 'encounterInterrupted', true);
			await pauseEncounterTrack(combat, currentMusic);
		}
		updateCombatMusic(combat, turnMusic, combatantToken.id);
		return;
	}

	// If the previous turn had interrupted, stop the turn music and resume the encounter track.
	const wasInterrupted = combat.getFlag(MODULE_ID, 'encounterInterrupted');
	if (wasInterrupted) {
		combat.setFlag(MODULE_ID, 'encounterInterrupted', false);
		const currentMusic = getCurrentMusic(combat);
		if (currentMusic) {
			const currentSound = parseMusic(currentMusic);
			if (!('error' in currentSound)) {
				if (currentSound.documentName === 'PlaylistSound') await currentSound.parent.stopSound(currentSound);
				else await currentSound.stopAll();
			}
		}
		// Resume the paused encounter sounds specifically.
		const pausedIds = combat.getFlag(MODULE_ID, 'pausedSounds') ?? [];
		for (const s of combatPaused.filter(s => pausedIds.includes(s.id))) await resume(s);
		await combat.unsetFlag(MODULE_ID, 'pausedSounds');
		combat._combatMusic = '';
		return;
	}

	// Check for Combat Theme tokens first.
	const themeMap = new Map();
	for (const combatant of combat.combatants.contents) {
		if (!combatant.token) continue;
		const token = combatant.token;
		if (!token.getFlag(MODULE_ID, 'combatTheme')) continue;
		const music = getTokenMusic(token);
		if (!music) continue;
		const priority = token.getFlag(MODULE_ID, 'priority') ?? 10;
		themeMap.set({ token: token.id, music }, priority);
	}

	if (themeMap.size > 0) {
		const themeHighest = getHighestPriority(themeMap);
		const picked = pick(themeHighest);
		updateCombatMusic(combat, picked.music, '');
		return;
	}

	// No Combat Theme — check for trait-based music rules (PF2e).
	const traitRules = getSetting('traitRules') ?? [];
	if (traitRules.length > 0) {
		const hostileTraits = new Set();
		for (const combatant of combat.combatants.contents) {
			if (!combatant.token?.actor) continue;
			if (combatant.token.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY) continue;
			for (const trait of (combatant.token.actor.system?.traits?.value ?? [])) hostileTraits.add(trait.toLowerCase());
		}
		if (hostileTraits.size > 0) {
			const matchingRules = traitRules.filter((r) => r.trait && hostileTraits.has(r.trait.toLowerCase()) && r.music);
			if (matchingRules.length > 0) {
				const best = matchingRules.reduce((a, b) => b.priority > a.priority ? b : a);
				updateCombatMusic(combat, best.music, '');
				return;
			}
		}
	}

	// Fall back to the standard priority playlist system.
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
