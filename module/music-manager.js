import { getSetting, SYSTEM_ID } from './settings.js';
import { getTokenMusic } from './token.js';
function playCombatMusic(combat) {
    if (getSetting('pauseAmbience'))
        pauseAllMusic();
    let music = combat.getFlag(SYSTEM_ID, 'overrideMusic');
    let token = '';
    if (!music) {
        const highestPriority = getHighestPriority(createPriorityList());
        token = highestPriority.token;
        music = highestPriority.music;
    }
    const sound = parseMusic(music);
    if (sound.parent)
        sound.parent.playSound(sound);
    else
        sound.playAll();
    setCombatMusic(sound, combat, token);
}
export async function updateCombatMusic(combat, music) {
    const oldMusic = combat.getFlag(SYSTEM_ID, 'overrideMusic');
    if (oldMusic === music)
        return;
    const oldSound = parseMusic(oldMusic);
    const sound = parseMusic(music);
    if (oldSound.parent) {
        oldSound.parent?.stopSound(oldSound);
    }
    else
        await oldSound.stopAll();
    if (sound.parent)
        sound.parent.playSound(sound);
    else
        sound.playAll();
    setCombatMusic(sound, combat);
}
function createPriorityList() {
    const base = getSetting('defaultPlaylist');
    const combatPlaylists = new Map(game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => [{ token: '', music: p.id }, +(p.id === base)]));
    for (const combatant of game.combat.combatants.contents) {
        if (!combatant.token)
            continue;
        const music = getTokenMusic(combatant.token), priority = combatant.token.getFlag(SYSTEM_ID, 'priority') ?? 10, token = combatant.token.id;
        if (music)
            combatPlaylists.set({ token, music }, priority);
    }
    return combatPlaylists;
}
function getHighestPriority(map) {
    const max = Math.max(...map.values());
    return pick([...map].filter(([p, v]) => v === max))[0];
}
function pick(array) {
    return array[~~(Math.random() * array.length)];
}
let paused = [];
function pauseAllMusic() {
    paused = game.playlists.playing.map((p) => p.sounds.contents.filter((p) => p.playing)).flat();
    for (const sound of paused)
        sound.update({ playing: false, pausedTime: sound.sound.currentTime });
}
function resumePlaylists(combat) {
    for (const sound of paused)
        sound.update({ playing: true });
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
export function stringifyMusic(sound) {
    return (sound?.parent ? sound.parent.id + '.' + sound.id : sound?.id) ?? '';
}
export function setCombatMusic(sound, combat = game.combat, token) {
    if (combat) {
        combat.update({
            [`flags.${SYSTEM_ID}`]: {
                overrideMusic: stringifyMusic(sound),
                token,
            },
        });
    }
}
export function setTokenConfig(token, resource, sounds, priority = 10) {
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
