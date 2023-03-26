import { getSetting, SYSTEM_ID } from './settings.js';
import { getTokenMusic } from './token.js';
function playCombatMusic(combat) {
    if (getCombatMusic().length === 0)
        return;
    if (getSetting('pauseAmbience'))
        pauseAllMusic();
    updateTurnMusic(combat);
}
export async function updateCombatMusic(combat, music, token) {
    const oldMusic = combat.getFlag(SYSTEM_ID, 'overrideMusic');
    if (oldMusic === music)
        return;
    const oldSound = parseMusic(oldMusic ?? '');
    const sound = parseMusic(music);
    if (oldSound) {
        if (oldSound.parent) {
            oldSound.parent?.stopSound(oldSound);
        }
        else
            await oldSound.stopAll();
    }
    if (sound.parent)
        sound.parent.playSound(sound);
    else
        sound.playAll();
    setCombatMusic(sound, combat, token);
}
function createPriorityList(tokenId) {
    const base = getSetting('defaultPlaylist');
    const combatPlaylists = new Map(getCombatMusic().map((p) => [{ token: '', music: p.id }, +(p.id === base)]));
    for (const combatant of game.combat.combatants.contents) {
        if (!combatant.token)
            continue;
        const music = getTokenMusic(combatant.token), priority = combatant.token.getFlag(SYSTEM_ID, 'priority') ?? 10, token = combatant.token.id;
        if (music && (combatant.token.getFlag(SYSTEM_ID, 'turnOnly') === false || token === tokenId))
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
export function setTokenConfig(token, resource, sounds, priority = 10, turnOnly = false) {
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
    return game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat'));
}
function updateTurnMusic(combat) {
    if (getCombatMusic().length === 0)
        return;
    let music = combat.started ? undefined : combat.getFlag(SYSTEM_ID, 'overrideMusic');
    let token = '';
    const turn = combat.started === false ? 0 : (combat.turn + 1) % combat.turns.length;
    const nextCombatant = combat.turns[turn];
    if (!music) {
        const highestPriority = getHighestPriority(createPriorityList(nextCombatant.tokenId));
        token = highestPriority.token;
        music = highestPriority.music;
    }
    updateCombatMusic(combat, music, token);
}
window.CombatMusicMaster = {
    setCombatMusic,
    setTokenConfig,
};
if (game.user.isGM) {
    Hooks.on('combatStart', playCombatMusic);
    Hooks.on('combatTurn', updateTurnMusic);
    Hooks.on('combatRound', updateTurnMusic);
    Hooks.on('deleteCombat', resumePlaylists);
}
