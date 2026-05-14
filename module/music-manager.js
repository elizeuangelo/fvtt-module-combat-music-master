import { DEFAULT_ENCOUNTER_MUSIC_PRIORITY, DEFAULT_TOKEN_MUSIC_PRIORITY, MODULE_ID } from './constants.js';
import { getSetting, setSetting } from './settings.js';
import { getTokenMusic } from './token.js';

function pauseAmbienceMusic() {
	if (getCombatMusic().length === 0) return;
	if (!getSetting('pauseAmbience')) return;
	if (getSetting('pausedAmbienceSounds').length) return;
	const paused = game.playlists.playing.map((p) => p.sounds.contents.filter((p) => p.playing)).flat();
	for (const sound of paused) {
		sound.update({ playing: false, pausedTime: sound.sound.currentTime });
	}
	setSetting(
		'pausedAmbienceSounds',
		paused.map((s) => stringifyMusic(s)),
	);
}

function getCombatPausedMusics(combat) {
	return [...createPriorityList(null, combat).keys()]
		.map(({ music }) => parseMusic(music))
		.filter((s) => s.pausedTime || s.playing);
}

function resumeAmbienceMusic(combat) {
	const paused = getSetting('pausedAmbienceSounds').map((s) => parseMusic(s));
	const combatPaused = getCombatPausedMusics(combat);
	combatPaused.forEach((sound) => {
		if (!paused.includes(sound)) sound.update({ playing: false, pausedTime: null });
	});
	combat.getFlag(MODULE_ID, 'combatPausedSounds', []);
	const sound = parseMusic(getCurrentMusic(combat));
	if (!('error' in sound)) {
		if (sound.documentName === 'Playlist') sound.stopAll();
		else sound.update({ playing: false, pausedTime: null });
	}
	combat._combatMusic = '';
	for (const sound of paused) sound.update({ playing: true });
	setSetting('pausedAmbienceSounds', []);
}

async function pause(sound) {
	const currentTime = sound.sound?.currentTime ?? null;
	await sound.update({ playing: false, pausedTime: currentTime });
}

async function resume(sound) {
	await sound.update({ playing: true });
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
	}
	if (sound.playing === false) {
		if (getSetting('pauseTrack') && sound.documentName === 'PlaylistSound') resume(sound);
		else {
			if (sound.documentName === 'PlaylistSound') sound.parent.playSound(sound);
			else sound.playAll();
		}
	}
	combat._combatMusic = music;
	setCombatMusic(sound, combat, token);
}

function createPriorityList(tokenId, combat = game.combat) {
	const base = getSetting('defaultPlaylist');
	const priorityList = new Map(getCombatMusic().map((p) => [{ source: 'settings', music: p.id }, +(p.id === base)]));

	// Combat music priority
	const combatMusic = combat.getFlag(MODULE_ID, 'overrideMusic');
	if (combatMusic) {
		const combatPriority = combat.getFlag(MODULE_ID, 'priority') ?? DEFAULT_ENCOUNTER_MUSIC_PRIORITY;
		priorityList.set({ source: 'encounter', music: combatMusic }, combatPriority);
	}

	// Tokens music priority
	for (const combatant of combat.combatants.contents) {
		if (!combatant.token) continue;
		const music = getTokenMusic(combatant.token),
			priority = combatant.token.getFlag(MODULE_ID, 'priority') ?? DEFAULT_TOKEN_MUSIC_PRIORITY,
			token = combatant.token.id;
		if (
			music &&
			(tokenId === null || combatant.token.getFlag(MODULE_ID, 'turnOnly') === false || token === tokenId)
		)
			priorityList.set({ source: token, music }, priority);
	}

	// Customized priorities
	Hooks.call('refreshCMMPriorityList', priorityList, combat);
	return priorityList;
}

export function getHighestPriority(map) {
	const max = Math.max(...map.values());
	return [...map].filter(([, v]) => v === max).map(([p]) => p);
}

export function pick(array) {
	return array[~~(Math.random() * array.length)];
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

export function setCombatMusic(sound, combat = game.combat, source) {
	if (combat) {
		combat.update({
			[`flags.${MODULE_ID}`]: {
				currentMusic: stringifyMusic(sound),
				source,
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

export function refreshTurnMusic(combat = game.combat) {
	if (!combat || !combat.started || getCombatMusic().length === 0) return;
	const highestPriority = getHighestPriority(createPriorityList(combat.combatant?.tokenId ?? '', combat));
	if (highestPriority.length === 0) return;
	const sorted = pick(highestPriority);
	updateCombatMusic(combat, sorted.music, sorted.token);
}

window.CombatMusicMaster = {
	setCombatMusic,
	setTokenConfig,
};

Hooks.once('setup', () => {
	if (game.user.isGM) {
		Hooks.on('combatStart', pauseAmbienceMusic);
		Hooks.on('preDeleteCombat', resumeAmbienceMusic);
		Hooks.on('combatTurnChange', refreshTurnMusic);
		Hooks.on('deleteCombatant', (combatant) => refreshTurnMusic(combatant.combat));
		Hooks.on('createCombatant', (combatant) => refreshTurnMusic(combatant.combat));
		Hooks.on('updateToken', (token) => {
			if (!game.combat || token.combatant?.combat !== game.combat) return;
			refreshTurnMusic();
		});
	}
});
