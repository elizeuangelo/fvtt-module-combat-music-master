import { getSetting, SYSTEM_ID } from './settings.js';
import { getTokenMusic } from './token.js';

function playCombatMusic(combat: Combat) {
	if (getSetting('pauseAmbience')) pauseAllMusic();

	let music = combat.getFlag(SYSTEM_ID, 'overrideMusic') as string;
	let token: string = '';

	if (!music) {
		const highestPriority = getHighestPriority(createPriorityList());

		token = highestPriority.token;
		music = highestPriority.music;
	}

	const sound = parseMusic(music)!;

	if (sound.parent) sound.parent.playSound(sound);
	else (sound as Playlist).playAll();
	setCombatMusic(sound, combat, token);
}

export async function updateCombatMusic(combat: Combat, music: string) {
	const oldMusic = combat.getFlag(SYSTEM_ID, 'overrideMusic') as string;
	if (oldMusic === music) return;

	const oldSound = parseMusic(oldMusic)!;
	const sound = parseMusic(music)!;

	if (oldSound.parent) {
		oldSound.parent?.stopSound(oldSound);
	} else await (oldSound as Playlist).stopAll();

	if (sound.parent) sound.parent.playSound(sound);
	else (sound as Playlist).playAll();

	setCombatMusic(sound, combat);
}

function createPriorityList() {
	const base = getSetting('defaultPlaylist');
	const combatPlaylists = new Map(
		game.playlists!.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => [{ token: '', music: p.id }, +(p.id === base)])
	);

	for (const combatant of game.combat!.combatants.contents) {
		if (!combatant.token) continue;
		const music = getTokenMusic(combatant.token) as string | undefined,
			priority = (combatant.token.getFlag(SYSTEM_ID, 'priority') as number | undefined) ?? 10,
			token = combatant.token.id!;

		if (music) combatPlaylists.set({ token, music }, priority);
	}

	return combatPlaylists;
}

function getHighestPriority(map: ReturnType<typeof createPriorityList>) {
	const max = Math.max(...map.values());
	return pick([...map].filter(([p, v]) => v === max))[0];
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
	for (const sound of paused) sound.update({ playing: true });
	paused = [];

	const sound = parseMusic(combat.getFlag(SYSTEM_ID, 'overrideMusic') as string);
	if (sound) (sound.parent ?? (sound as Playlist)).stopAll();
}

export function parseMusic(flag: string) {
	const rgx = /(\w+)\.?(\w+)?/.exec(flag);
	if (!rgx) return;
	const playlist = game.playlists!.get(rgx[1]),
		sound = playlist?.sounds.get(rgx[2]);

	return sound ?? playlist;
}

function stringifyMusic(sound?: Playlist | PlaylistSound) {
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
				overrideMusic: stringifyMusic(sound),
				token,
			},
		});
	}
}

export function setTokenConfig(token: TokenDocument, resource: string, sounds?: [Playlist | PlaylistSound, number][], priority = 10) {
	sounds = (sounds ?? []).sort((a, b) => b[1] - a[1]);

	token.update({
		[`flags.${SYSTEM_ID}`]: {
			resource,
			priority,
			musicList: sounds.map(([sound, threshold]) => [stringifyMusic(sound), threshold]),
		},
	});
}

window.CombatMusicMaster = {
	setCombatMusic,
	setTokenConfig,
};

Hooks.on('combatStart', playCombatMusic);
Hooks.on('deleteCombat', resumePlaylists);
