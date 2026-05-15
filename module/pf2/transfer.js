import { parseMusic } from '../music-manager.js';
import { getSetting, setSetting } from '../settings.js';

Hooks.on('CMMExport', (data) => {
	const traitRules = getSetting('traitRules');
	const resolvedTraitRules = traitRules.map((rule) => {
		const sound = parseMusic(rule.music);
		const playlist = 'error' in sound ? null : (sound.parent ?? sound);
		const track = playlist && sound !== playlist ? sound : null;
		return {
			trait: rule.trait,
			priority: rule.priority,
			playlistName: playlist?.name ?? '',
			trackName: track?.name ?? '',
		};
	});
	data.traitRules = resolvedTraitRules;
});

Hooks.on('CMMImport', (data, playlistMap) => {
	if (!data.traitRules) return;
	const resolvedRules = data.traitRules
		.map((rule) => {
			const playlist = playlistMap.get(rule.playlistName);
			const track = rule.trackName ? playlist?.sounds.contents.find((s) => s.name === rule.trackName) : null;
			const music = track ? playlist.id + '.' + track.id : (playlist?.id ?? '');
			return {
				trait: rule.trait,
				priority: rule.priority,
				playlistId: playlist?.id ?? '',
				trackId: track?.id ?? '',
				music,
			};
		})
		.filter((r) => r.music);
	setSetting('traitRules', resolvedRules);
});
