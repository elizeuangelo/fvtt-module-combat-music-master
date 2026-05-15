import { DEFAULT_ENCOUNTER_MUSIC_PRIORITY, MODULE_ID } from './constants.js';
import { createPriorityList, getCombatMusic, parseMusic, refreshTurnMusic, stringifyMusic } from './music-manager.js';
import { getSetting } from './settings.js';
import { createOption } from './token.js';
import { debugLog } from './utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class CombatTrackerMusicManager extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'combat-master-tracker',
		tag: 'form',
		window: {
			contentClasses: ['standard-form'],
			icon: 'fa-solid fa-music',
			title: 'Set Encounter Music',
		},
		position: { width: 400 },
		form: {
			closeOnSubmit: true,
			handler: CombatTrackerMusicManager.#saveSettings,
		},
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/tracker.hbs', scrollable: [''] },
		footer: { template: 'templates/generic/form-footer.hbs' },
	};

	/* -------------------------------------------- */

	static #schema = new foundry.data.fields.SchemaField({
		playlist: new foundry.data.fields.StringField({
			name: 'playlist',
			label: 'Playlist',
			hint: 'Choose a playlist.',
			initial: '',
			blank: true,
		}),
		track: new foundry.data.fields.StringField({
			name: 'track',
			label: 'Track',
			hint: 'Choose a track.',
			initial: '',
			blank: true,
		}),
		priority: new foundry.data.fields.NumberField({
			name: 'priority',
			label: 'Priority',
			initial: DEFAULT_ENCOUNTER_MUSIC_PRIORITY,
		}),
	});

	async _prepareContext() {
		const playlists = game.playlists.contents
			.filter((p) => p.getFlag(MODULE_ID, 'combat'))
			.map((p) => ({ value: p.id, label: p.name }));
		const selected = parseMusic(game.combat.getFlag(MODULE_ID, 'music'));
		const playlist = selected.data?.playlist;
		const track = selected.data?.track;
		const tracks = playlist ? playlist.sounds.contents.map((s) => ({ value: s.id, label: s.name })) : [];
		const priority = game.combat.getFlag(MODULE_ID, 'priority') ?? DEFAULT_ENCOUNTER_MUSIC_PRIORITY;
		return {
			rootId: this.id,
			playlists,
			selectedPlaylist: playlist?.id,
			selectedTrack: track?.id,
			fields: CombatTrackerMusicManager.#schema.fields,
			tracks,
			priority,
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners                             */
	/* -------------------------------------------- */

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.element.querySelector('select[name=playlist]').addEventListener('change', this.#selectPlaylist.bind(this));
	}

	#selectPlaylist(ev) {
		const playlist = game.playlists.get(ev.target.value);
		const tracks = playlist?.sounds.contents ?? [];
		this.element.querySelector('select[name=track]').innerHTML = [undefined, ...tracks]
			.map((track) => createOption(track))
			.join('');
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	/**
	 * Save all settings.
	 */
	static async #saveSettings(_event, _form, submitData) {
		const data = foundry.utils.expandObject(submitData.object);
		const playlist = game.playlists.get(data.playlist);
		const track = playlist?.sounds.get(data.track);
		const sound = stringifyMusic(track ?? playlist);
		const priority = data.priority;
		debugLog('Saving encounter music override', {
			combatId: game.combat?.id,
			playlistId: data.playlist,
			trackId: data.track,
			sound,
			priority,
			started: game.combat?.started,
		});
		game.combat
			?.update({
				[`flags.${MODULE_ID}`]: {
					music: sound,
					priority,
				},
			})
			.then(() => {
				if (game.combat.started) refreshTurnMusic(game.combat);
			});
	}
}

class CombatMusicInspector extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'combat-master-inspector',
		tag: 'section',
		window: {
			contentClasses: ['cmm-inspector'],
			icon: 'fa-solid fa-waveform-lines',
			title: 'Combat Music Inspector',
		},
		position: { width: 520, height: 'auto' },
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/inspector.hbs', scrollable: [''] },
	};

	static getInstance() {
		return [...this.instances()][0];
	}

	explainCombatMusicDecision(combat = game.combat) {
		if (!combat?.started) {
			return {
				started: false,
				reason: 'Combat is not started.',
				music: '',
				winner: '',
				candidates: [],
			};
		}

		const candidatesMap = createPriorityList(combat.combatant?.tokenId, combat);
		const candidates = [...candidatesMap.entries()]
			.map(([choice, priority]) => ({
				token: choice.token,
				music: choice.music,
				priority,
				parsed: parseMusic(choice.music),
				source: choice.source,
			}))
			.sort((a, b) => b.priority - a.priority);
		const winner = getCombatMusic(combat);
		const winnerSource = combat.getFlag(MODULE_ID, 'source');
		return {
			started: true,
			reason: 'Winner chosen from highest-priority candidates.',
			winner,
			winnerSource,
			candidates,
		};
	}

	_prepareContext() {
		const decision = this.explainCombatMusicDecision(game.combat);
		const winner = parseMusic(decision.winner);
		let winnerLabel =
			!decision.winner || !winner.data
				? decision.winner || '(none)'
				: winner.data.track
					? `${winner.data.playlist.name} / ${winner.data.track.name}`
					: winner.data.playlist.name;
		winnerLabel += ` (${decision.winnerSource})`;
		const candidates = (decision.candidates ?? []).map((c) => {
			const parsed = c.parsed;
			if (!parsed.data) return { ...c, label: `${c.music} (${parsed.error ?? 'empty'})` };
			const label = parsed.data.track
				? `${parsed.data.playlist.name} / ${parsed.data.track.name}`
				: parsed.data.playlist.name;
			const isWinner =
				decision.winnerSource === c.source &&
				parsed.data.playlist === winner.data.playlist &&
				parsed.data.track === winner.data.track;
			return { ...c, label, source: c.source, isWinner };
		});
		return {
			...decision,
			winnerLabel,
			candidates,
		};
	}
}

Hooks.on('getCombatContextOptions', addButtonToContextMenu);
function addButtonToContextMenu(_combatTracker, options) {
	options.unshift({
		label: 'Set Encounter Music',
		icon: '<i class="fas fa-music"></i>',
		visible: () => game.user.isGM,
		onClick: () => {
			new CombatTrackerMusicManager().render(true);
		},
	});
	if (getSetting('enableInspector')) {
		options.unshift({
			label: 'Inspect Combat Music Decision',
			icon: '<i class="fas fa-waveform-lines"></i>',
			visible: () => game.user.isGM,
			onClick: () => {
				new CombatMusicInspector().render(true);
			},
		});
	}
}

Hooks.on('CMMRefreshturnMusic', () => {
	CombatMusicInspector.getInstance()?.render(true);
});
