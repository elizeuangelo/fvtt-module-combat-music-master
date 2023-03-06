import { getSetting, SYSTEM_ID } from './settings.js';

function playCombatMusic(combat: Combat) {
	if (getSetting('pauseAmbience')) stopAllMusic();
	const sound = parseMusic(combat.getFlag(SYSTEM_ID, 'overrideMusic') as string) || getHighestPriority(createPriorityList());

	if (sound.parent) sound.parent.playSound(sound);
	else (sound as Playlist).playAll();
	setCombatMusic(sound.parent ?? sound);
}

function createPriorityList() {
	const combatPlaylists = new Map<Playlist | PlaylistSound, number>(
		game.playlists!.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => [p, 0])
	);

	const base = game.playlists!.get(getSetting('defaultPlaylist'));
	if (base) combatPlaylists.set(base, 1);

	for (const combatant of game.combat!.combatants.contents) {
		if (!combatant.token) continue;
		const playlist = game.playlists!.get(combatant.token.getFlag(SYSTEM_ID, 'combatPlaylist') as string),
			music = playlist?.sounds.get(combatant.token.getFlag(SYSTEM_ID, 'combatMusic') as string),
			priority = combatant.token.getFlag(SYSTEM_ID, 'musicPriority') as number;

		const key = (music || playlist)!;
		if (playlist && (combatPlaylists.get(key) ?? 0) < priority) combatPlaylists.set(key, priority);
	}

	return combatPlaylists;
}

function getHighestPriority(map: ReturnType<typeof createPriorityList>) {
	const max = Math.max(...map.values());
	return pick([...map].filter(([p, v]) => v === max).map(([p, v]) => p));
}

function pick<T>(array: T[]): T {
	return array[~~(Math.random() * array.length)];
}

let paused: Playlist[] = [];
function stopAllMusic() {
	paused = [...game.playlists!.playing];
	for (const playlist of paused) playlist.stopAll();
}

function resumePlaylists(combat: Combat) {
	if (game.combats!.size) return;
	for (const playlist of paused) playlist.playAll();
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
export function setCombatMusic(sound?: Playlist | PlaylistSound, combat = game.combat) {
	combat?.setFlag(SYSTEM_ID, 'overrideMusic', stringifyMusic(sound));
}

export function setTokenPriority(token: TokenDocument, sound?: Playlist | PlaylistSound, priority = 10) {
	token.setFlag(SYSTEM_ID, 'combatMusic', stringifyMusic(sound));
	token.setFlag(SYSTEM_ID, 'musicPriority', priority);
}

window.CombatMusicMaster = {
	setCombatMusic,
	setTokenPriority,
};

Hooks.on('combatStart', playCombatMusic);
Hooks.on('deleteCombat', resumePlaylists);
