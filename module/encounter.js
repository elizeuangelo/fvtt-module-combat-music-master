import { DEFAULT_ENCOUNTER_MUSIC_PRIORITY, MODULE_ID } from './constants.js';
import { explainCombatMusicDecision, parseMusic, refreshTurnMusic, stringifyMusic } from './music-manager.js';
import { getSetting } from './settings.js';
import { createOption } from './token.js';

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
			contentClasses: ['standard-form', 'cmm-inspector'],
			icon: 'fa-solid fa-waveform-lines',
			title: 'Combat Music Inspector',
		},
		position: { width: 520, height: 'auto' },
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/inspector.hbs', scrollable: [''] },
	};

	_prepareContext() {
		const decision = explainCombatMusicDecision(game.combat);
		const winner = parseMusic(decision.winner);
		const winnerLabel = !decision.winner.data
			? decision.winner || '(none)'
			: winner.data.track
				? `${winner.data.playlist} / ${winner.data.track.name}`
				: winner.data.playlist.name;
		return {
			...decision,
			winnerLabel,
			candidates: (decision.candidates ?? []).map((c) => {
				const parsed = c.parsed;
				if (!parsed.data) return { ...c, label: `${c.music} (${parsed.error ?? 'empty'})` };
				const label = parsed.data.track
					? `${parsed.data.playlist.name} / ${parsed.data.track.name}`
					: parsed.data.track.name;
				return { ...c, label };
			}),
		};
	}
}

Hooks.on('getCombatContextOptions', addButtonToContextMenu);
function addButtonToContextMenu(_combatTracker, options) {
	options.unshift({
		name: 'Set Encounter Music',
		icon: '<i class="fas fa-music"></i>',
		condition: () => game.user.isGM,
		callback: () => {
			new CombatTrackerMusicManager().render(true);
		},
	});
	if (getSetting('enableInspector')) {
		options.unshift({
			name: 'Inspect Combat Music Decision',
			icon: '<i class="fas fa-waveform-lines"></i>',
			condition: () => game.user.isGM,
			callback: () => {
				new CombatMusicInspector().render(true);
			},
		});
	}
}
