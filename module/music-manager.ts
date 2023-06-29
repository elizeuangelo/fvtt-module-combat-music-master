import { getSetting, SYSTEM_ID } from './settings.js';
import { getTokenMusic } from './token.js';

function playCombatMusic(combat: Combat) {
	if (getCombatMusic().length === 0) return;
	if (getSetting('pauseAmbience')) pauseAllMusic();
	updateTurnMusic(combat);
}

let combatPaused: PlaylistSound[] = [];
async function pause(sound: PlaylistSound) {
	combatPaused.push(sound);
	sound.update({ playing: false, pausedTime: sound.sound!.currentTime });
}
async function resume(sound: PlaylistSound) {
	sound.update({ playing: true });
	const idx = combatPaused.indexOf(sound);
	if (idx === -1) return;
	combatPaused.splice(idx, 1);
}

export async function updateCombatMusic(combat: Combat, music: string, token?: string) {
	const oldMusic = combat._combatMusic;
	if (oldMusic === music) return;

	const oldSound = parseMusic(oldMusic ?? '');
	const sound = parseMusic(music)!;

	if ('error' in sound) {
		if (sound.error === 'not found') ui.notifications.error(`${sound.rgx[2] ? 'Track' : 'Playlist'} not found.`);
		if (sound.error === 'invalid flag') ui.notifications.error('Bad configuration.');
		return;
	}

	if (!('error' in oldSound)) {
		if (getSetting('pauseTrack') && oldSound.documentName === 'PlaylistSound') await pause(oldSound);
		else {
			if (oldSound.documentName === 'PlaylistSound') await oldSound.parent!.stopSound(oldSound);
			else await oldSound.stopAll();
		}
	}

	if (getSetting('pauseTrack') && sound.documentName === 'PlaylistSound') resume(sound);
	else {
		if (sound.documentName === 'PlaylistSound') sound.parent!.playSound(sound);
		else sound.playAll();
	}

	combat._combatMusic = music;
	setCombatMusic(sound, combat, token);
}

function createPriorityList(tokenId: string | undefined) {
	const base = getSetting('defaultPlaylist');
	const combatPlaylists = new Map(getCombatMusic().map((p) => [{ token: '', music: p.id }, +(p.id === base)]));

	for (const combatant of game.combat!.combatants.contents) {
		if (!combatant.token) continue;
		const music = getTokenMusic(combatant.token) as string | undefined,
			priority = (combatant.token.getFlag(SYSTEM_ID, 'priority') as number | undefined) ?? 10,
			token = combatant.token.id!;

		if (music && (combatant.token.getFlag(SYSTEM_ID, 'turnOnly') === false || token === tokenId))
			combatPlaylists.set({ token, music }, priority);
	}

	return combatPlaylists;
}

function getHighestPriority(map: ReturnType<typeof createPriorityList>) {
	const max = Math.max(...map.values());
	return [...map].filter(([p, v]) => v === max).map(([p, v]) => p);
}

function pick<T>(array: T[]): T {
	return array[~~(Math.random() * array.length)];
}

let paused: PlaylistSound[] = [];
function pauseAllMusic() {
	paused = game.playlists!.playing.map((p) => p.sounds.contents.filter((p) => p.playing)).flat();
	for (const sound of paused) sound.update({ playing: false, pausedTime: sound.sound!.currentTime });
}

function resumePlaylists(combat: Combat) {
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

export function parseMusic(flag: string) {
	const rgx = /(\w+)\.?(\w+)?/.exec(flag);
	if (!rgx) return { error: 'invalid flag' } as const;
	const playlist = game.playlists!.get(rgx[1]),
		sound = playlist?.sounds.get(rgx[2]);

	return sound ?? playlist ?? ({ error: 'not found', rgx } as const);
}

export function stringifyMusic(sound?: Playlist | PlaylistSound) {
	return (sound?.parent ? sound.parent.id + '.' + sound.id : sound?.id) ?? '';
}

/**
 * Sets a music override for the combat
 * @param sound Sound or Playlist to play
 * @param combat Combat triggering the sound
 */
export function setCombatMusic(sound?: Playlist | PlaylistSound, combat: Combat = game.combat!, token?: string) {
	if (combat) {
		combat.update({
			[`flags.${SYSTEM_ID}`]: {
				currentMusic: stringifyMusic(sound),
				token,
			},
		});
	}
}

export function setTokenConfig(
	token: TokenDocument,
	resource: string,
	sounds?: [Playlist | PlaylistSound, number][],
	priority = 10,
	turnOnly = false
) {
	sounds = (sounds ?? []).sort((a, b) => b[1] - a[1]);

	token.update({
		[`flags.${SYSTEM_ID}`]: {
			resource,
			priority,
			musicList: sounds.map(([sound, threshold]) => [stringifyMusic(sound), threshold]),
			turnOnly,
		},
	});
}

export function getCombatMusic() {
	return game.playlists!.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat'));
}

export function updateTurnMusic(combat: Combat) {
	if (getCombatMusic().length === 0) return;
	let music = combat.getFlag(SYSTEM_ID, 'overrideMusic') as string | undefined;
	let token: string = '';
	if (!music) {
		const turn = combat.started === false ? 0 : (combat.turn! + 1) % combat.turns.length;
		const nextCombatant = combat.turns[turn];
		const highestPriority = getHighestPriority(createPriorityList(nextCombatant?.tokenId!));

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

if (game.user!.isGM) {
	Hooks.on('combatStart', playCombatMusic);
	Hooks.on('combatTurn', updateTurnMusic);
	Hooks.on('combatRound', updateTurnMusic);
	Hooks.on('deleteCombat', resumePlaylists);
}
