import { getSetting, setSetting, MODULE_ID } from './settings.js';
import { getCombatMusic, parseMusic, stringifyMusic } from './music-manager.js';
import { createOption } from './token.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TraitMusicManager extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'combat-master-trait-config',
		tag: 'form',
		window: {
			contentClasses: ['standard-form'],
			icon: 'fa-solid fa-skull',
			title: 'Trait Music Rules',
		},
		position: { width: 650, height: 'auto' },
		form: {
			closeOnSubmit: true,
			handler: TraitMusicManager.#saveSettings,
		},
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/trait-music.hbs', scrollable: [''] },
		footer: { template: 'templates/generic/form-footer.hbs' },
	};

	_preview = [];

	_prepareContext() {
		const rules = this._preview.length ? this._preview : (getSetting('traitRules') ?? []);
		return {
			rules,
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	_onRender(context, options) {
		super._onRender(context, options);
		console.log('CMM | TraitMusicManager _onRender fired', this.element);
		this.#populatePlaylistOptions(context);
		this.#setupEventListeners();
		console.log('CMM | addRule button:', this.element.querySelector('[data-action="addRule"]'));
	}

	#populatePlaylistOptions(context) {
		const combatPlaylists = getCombatMusic();
		this.element.querySelectorAll('fieldset.trait-rule').forEach((fieldset, index) => {
			const rule = context.rules[index];
			if (!rule) return;

			const playlistSelect = fieldset.querySelector('select[name="playlist"]');
			playlistSelect.innerHTML = '<option value=""></option>';
			combatPlaylists.forEach((playlist) => {
				const option = document.createElement('option');
				option.value = playlist.id;
				option.textContent = playlist.name;
				option.selected = playlist.id === rule.playlistId;
				playlistSelect.appendChild(option);
			});

			if (rule.playlistId) this.#populateTrackOptions(playlistSelect, rule.playlistId, rule.trackId);

			playlistSelect.addEventListener('change', (ev) => this.#populateTrackOptions(ev.target, ev.target.value));
		});
	}

	#populateTrackOptions(playlistSelect, playlistId, selectedTrackId = '') {
		const trackSelect = playlistSelect.closest('fieldset').querySelector('select[name="track"]');
		trackSelect.innerHTML = '<option value=""></option>';
		const playlist = game.playlists.get(playlistId);
		if (!playlist) return;
		playlist.sounds.contents.forEach((track) => {
			const option = document.createElement('option');
			option.value = track.id;
			option.textContent = track.name;
			option.selected = track.id === selectedTrackId;
			trackSelect.appendChild(option);
		});
	}

	#setupEventListeners() {
		this.element.querySelector('[data-action="addRule"]')?.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			this._preview = this.#getRuleData();
			this._preview.push({ trait: '', playlistId: '', trackId: '', priority: 10 });
			this.render(true);
		});

		this.element.querySelectorAll('[data-action="removeRule"]').forEach((btn) => {
			btn.addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				const index = parseInt(btn.closest('fieldset').dataset.index);
				this._preview = this.#getRuleData();
				this._preview.splice(index, 1);
				this.render(true);
			});
		});
	}

	#getRuleData() {
		return [...this.element.querySelectorAll('fieldset.trait-rule')].map((fieldset) => {
			const trait = fieldset.querySelector('input[name="trait"]').value.trim().toLowerCase();
			const playlistId = fieldset.querySelector('select[name="playlist"]').value;
			const trackId = fieldset.querySelector('select[name="track"]').value;
			const priority = parseInt(fieldset.querySelector('input[name="priority"]').value) || 10;
			const playlist = game.playlists.get(playlistId);
			const track = playlist?.sounds.get(trackId);
			return { trait, playlistId, trackId, music: stringifyMusic(track ?? playlist), priority };
		});
	}

	static async #saveSettings(_event, _form, _formData) {
		const rules = this.#getRuleData();
		await setSetting('traitRules', rules);
	}
}

class PlaylistManager extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'combat-master-config',
		tag: 'form',
		window: {
			contentClasses: ['standard-form'],
			icon: 'fa-solid fa-music',
			title: 'Combat Music Master',
		},
		position: { width: 400 },
		form: {
			closeOnSubmit: true,
			handler: PlaylistManager.#saveSettings,
		},
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/config.hbs', scrollable: [''] },
		footer: { template: 'templates/generic/form-footer.hbs' },
	};

	/* -------------------------------------------- */

	_prepareContext() {
		return {
			playlists: game.playlists.contents.map((playlist) => ({
				playlist,
				active: playlist.getFlag(MODULE_ID, 'combat') || false,
				default: getSetting('defaultPlaylist') === playlist.id,
			})),
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners                             */
	/* -------------------------------------------- */

	_tearDown(options) {
		super._tearDown(options);
		this.#search.unbind();
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.#search.bind(this.element);
		this.element
			.querySelectorAll('label.playlist-name')
			.forEach((label) => label.addEventListener('click', this.#selectPlaylist.bind(this)));
		this.element
			.querySelectorAll('input[name=combat]')
			.forEach((label) => label.addEventListener('click', this.#removeStar.bind(this)));
	}

	/**
	 * Search-filter handling
	 */
	#search = new foundry.applications.ux.SearchFilter({
		inputSelector: 'input[type=search]',
		contentSelector: '.cmm-playlists',
		callback: this._onSearchFilter.bind(this),
	});

	#selectPlaylist(ev) {
		ev.preventDefault();
		const target = ev.target;
		const star = this.element.querySelector('label.star');
		const toggle = target.classList.toggle('star');
		if (star && star !== target) star.classList.remove('star');
		const id = target.getAttribute('for');
		if (toggle) this.element.querySelector(`#${id}`).checked = toggle;
	}

	#removeStar(ev) {
		const target = ev.target;
		const star = target.parentElement.querySelector('label.star');
		if (star && target.checked === false) star.classList.remove('star');
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	static async #saveSettings(_event, _form, submitData) {
		const data = foundry.utils.expandObject(submitData.object);
		const playlists = game.playlists.contents;
		if (data.combat === undefined) return;
		if (typeof data.combat === 'boolean') data.combat = [data.combat];
		if (playlists.length !== data.combat.length) {
			ui.notifications.error(`Playlists changed while configuration window was on.`);
		}
		for (let i = 0; i < playlists.length; i++) {
			const playlist = playlists[i],
				active = data.combat[i];
			if (playlist.getFlag(MODULE_ID, 'combat') != active) playlist.setFlag(MODULE_ID, 'combat', active);
		}
		const standard = this.element.querySelector('label.star')?.getAttribute('for').substring(9) ?? '';
		setSetting('defaultPlaylist', standard);
	}

	_onSearchFilter(_event, query, rgx, html) {
		for (let li of html.children) {
			if (!query) {
				li.classList.remove('hidden');
				continue;
			}
			const name = (li.querySelector('.playlist-name')?.textContent || '').trim();
			const match = rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(name));
			li.classList.toggle('hidden', !match);
		}
	}
}

Hooks.once('setup', () => {
	game.settings.registerMenu(MODULE_ID, 'combatMusicMenu', {
		name: 'Combat Music Master',
		label: 'Combat Playlists',
		hint: 'Select which ones are your combat playlists.',
		icon: 'fas fa-music',
		type: PlaylistManager,
		restricted: true,
	});
	game.settings.registerMenu(MODULE_ID, 'traitMusicMenu', {
		name: 'Trait Music Rules',
		label: 'Trait Rules',
		hint: 'Map PF2e traits to tracks that play when those creatures are in combat.',
		icon: 'fas fa-skull',
		type: TraitMusicManager,
		restricted: true,
	});
});
