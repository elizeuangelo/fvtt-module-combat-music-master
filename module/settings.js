export const SYSTEM_ID = 'combat-music-master';
const settings = {
    pauseAmbience: {
        name: 'Pause Ambience Sounds',
        hint: 'When combat starts, all ambience sound is paused. It resumes once combat finishes.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    },
    defaultPlaylist: {
        name: 'Default Playlist',
        hint: 'Select the default playlist, otherwise one will be selected at random. Reload to update the list.',
        scope: 'world',
        config: false,
        type: String,
        default: '',
    },
};
export function getSetting(name) {
    return game.settings.get(SYSTEM_ID, name);
}
export function setSetting(name, value) {
    return game.settings.set(SYSTEM_ID, name, value);
}
Hooks.once('setup', () => {
    for (const [key, setting] of Object.entries(settings)) {
        game.settings.register(SYSTEM_ID, key, setting);
    }
});
