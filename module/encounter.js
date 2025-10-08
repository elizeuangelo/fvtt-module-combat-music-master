import { parseMusic, stringifyMusic, updateTurnMusic } from './music-manager.js';
import { MODULE_ID } from './settings.js';
import { createOption } from './token.js';

class CombatTrackerMusicManager extends foundry.applications.api.HandlebarsApplicationMixin(
	foundry.applications.api.ApplicationV2
) {
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
	});

	async _prepareContext() {
		const playlists = game.playlists.contents
			.filter((p) => p.getFlag(MODULE_ID, 'combat'))
			.map((p) => ({ value: p.id, label: p.name }));
		const selected = parseMusic(game.combat.getFlag(MODULE_ID, 'overrideMusic'));
		const playlist = 'error' in selected ? undefined : selected?.parent ?? selected;
		const track = playlist === selected ? undefined : 'error' in selected ? undefined : selected;
		const tracks = playlist ? playlist.sounds.contents.map((s) => ({ value: s.id, label: s.name })) : [];
		return {
			rootId: this.id,
			playlists,
			selectedPlaylist: playlist?.id,
			selectedTrack: track?.id,
			fields: CombatTrackerMusicManager.#schema.fields,
			tracks,
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
		game.combat
			?.update({
				[`flags.${MODULE_ID}.overrideMusic`]: sound,
			})
			.then(() => {
				if (game.combat.started) updateTurnMusic(game.combat);
			});
	}
}

Hooks.on('getCombatContextOptions', addButtonToContextMenu);
function addButtonToContextMenu(_combatTracker, options) {
	options.push({
		name: 'Set Encounter Music',
		icon: '<i class="fas fa-music"></i>',
		condition: () => game.user.isGM,
		callback: () => {
			new CombatTrackerMusicManager().render(true);
		},
	});
}
