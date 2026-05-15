import { parseMusic } from '../music-manager.js';
import { getSetting, setSetting } from '../settings.js';

Hooks.on('CMMExport', (data) => {
	const traitRules = getSetting('traitRules');
	const resolvedTraitRules = traitRules
		.map((rule) => {
			const parsedMusic = parseMusic(rule.music);
			if (!parsedMusic.data) return null;
			const playlist = parsedMusic.data.playlist;
			const track = parsedMusic.data.track;
			return {
				trait: rule.trait,
				priority: rule.priority,
				playlistName: playlist.name,
				trackName: track?.name ?? '',
			};
		})
		.filter(Boolean);
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
