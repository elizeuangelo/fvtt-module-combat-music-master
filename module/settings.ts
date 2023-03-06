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
} as const;

export type Settings = typeof settings;

export function getSetting<T extends keyof Settings>(name: T) {
	return game.settings.get(SYSTEM_ID, name) as unknown as ReturnType<Settings[T]['type']>;
}

export function setSetting<T extends keyof Settings>(name: T, value: ReturnType<Settings[T]['type']>) {
	return game.settings.set(SYSTEM_ID, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(SYSTEM_ID, key, setting as unknown as any);
	}
});
