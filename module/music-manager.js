import { getSetting, SYSTEM_ID } from './settings.js';
function playCombatMusic(combat) {
    if (getSetting('pauseAmbience'))
        stopAllMusic();
    const sound = parseMusic(combat.getFlag(SYSTEM_ID, 'overrideMusic')) || getHighestPriority(createPriorityList());
    if (sound.parent)
        sound.parent.playSound(sound);
    else
        sound.playAll();
    setCombatMusic(sound.parent ?? sound);
}
function createPriorityList() {
    const combatPlaylists = Object.fromEntries(game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => [p.id, 0]));
    const base = game.playlists.get(getSetting('defaultPlaylist'));
    if (base)
        combatPlaylists[base.id] = 1;
    for (const combatant of game.combat.combatants.contents) {
        if (!combatant.token)
            continue;
        const music = combatant.token.getFlag(SYSTEM_ID, 'combatMusic'), priority = combatant.token.getFlag(SYSTEM_ID, 'musicPriority');
        if (music && (combatPlaylists[music] ?? 0) < priority)
            combatPlaylists[music] = priority;
    }
    return combatPlaylists;
}
function getHighestPriority(map) {
    const max = Math.max(...Object.values(map));
    return parseMusic(pick([...Object.entries(map)].filter(([p, v]) => v === max).map(([p, v]) => p)));
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
    const sound = parseMusic(combat.getFlag(SYSTEM_ID, 'overrideMusic'));
    if (sound)
        (sound.parent ?? sound).stopAll();
}
export function parseMusic(flag) {
    const rgx = /(\w+)\.?(\w+)?/.exec(flag);
    if (!rgx)
        return;
    const playlist = game.playlists.get(rgx[1]), sound = playlist?.sounds.get(rgx[2]);
    return sound ?? playlist;
}
function stringifyMusic(sound) {
    return (sound?.parent ? sound.parent.id + '.' + sound.id : sound?.id) ?? '';
}
export function setCombatMusic(sound, combat = game.combat) {
    combat?.setFlag(SYSTEM_ID, 'overrideMusic', stringifyMusic(sound));
}
export function setTokenPriority(token, sound, priority = 10) {
    token.setFlag(SYSTEM_ID, 'combatMusic', stringifyMusic(sound));
    token.setFlag(SYSTEM_ID, 'musicPriority', priority);
}
window.CombatMusicMaster = {
    setCombatMusic,
    setTokenPriority,
};
Hooks.on('combatStart', playCombatMusic);
Hooks.on('deleteCombat', resumePlaylists);
