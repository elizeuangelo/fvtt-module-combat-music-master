import { getSetting, SYSTEM_ID } from './settings.js';
function playCombatMusic(combat) {
    if (getSetting('pauseAmbience'))
        stopAllMusic();
    const sound = parseMusic(combat) || getHighestPriority(createPriorityList());
    if (sound.parent)
        sound.parent.playSound(sound);
    else
        sound.playAll();
    setCombatMusic(sound.parent ?? sound);
}
function createPriorityList() {
    const combatPlaylists = new Map(game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => [p, 0]));
    const base = game.playlists.get(getSetting('defaultPlaylist'));
    if (base)
        combatPlaylists.set(base, 1);
    for (const combatant of game.combat.combatants.contents) {
        if (!combatant.token)
            continue;
        const playlist = game.playlists.get(combatant.token.getFlag(SYSTEM_ID, 'combatPlaylist')), music = playlist?.sounds.get(combatant.token.getFlag(SYSTEM_ID, 'combatMusic')), priority = combatant.token.getFlag(SYSTEM_ID, 'musicPriority');
        const key = (music || playlist);
        if (playlist && (combatPlaylists.get(key) ?? 0) < priority)
            combatPlaylists.set(key, priority);
    }
    return combatPlaylists;
}
function getHighestPriority(map) {
    const max = Math.max(...map.values());
    return pick([...map].filter(([p, v]) => v === max).map(([p, v]) => p));
}
function pick(array) {
    return array[~~(Math.random() * array.length)];
}
let paused = [];
function stopAllMusic() {
    paused = [...game.playlists.playing];
    for (const playlist of paused)
        playlist.stopAll();
}
function resumePlaylists(combat) {
    if (game.combats.size)
        return;
    for (const playlist of paused)
        playlist.playAll();
    paused = [];
    const sound = parseMusic(combat);
    if (sound)
        (sound.parent ?? sound).stopAll();
}
export function parseMusic(combat) {
    const rgx = /(\w+)\.?(\w+)?/.exec(combat.getFlag(SYSTEM_ID, 'overrideMusic'));
    if (!rgx)
        return;
    const playlist = game.playlists.get(rgx[1]), sound = playlist?.sounds.get(rgx[2]);
    return sound ?? playlist;
}
export function setCombatMusic(sound, combat = game.combat) {
    combat?.setFlag(SYSTEM_ID, 'overrideMusic', (sound?.parent ? sound.parent.id + '.' + sound.id : sound?.id) ?? '');
}
window.CombatMusicMaster = {
    setCombatMusic,
};
Hooks.on('combatStart', playCombatMusic);
Hooks.on('deleteCombat', resumePlaylists);
