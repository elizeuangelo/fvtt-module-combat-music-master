import { getCombatMusic, stringifyMusic } from '../music-manager.js';
import { getSetting, MODULE_ID, setSetting } from '../settings.js';

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

	_preview = null;

	_prepareContext() {
		const rules = (this._preview ??= getSetting('traitRules') ?? []);
		return {
			rules,
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.#populatePlaylistOptions(context);
		this.#setupEventListeners();
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

	/**
	 * @this TraitMusicManager
	 */
	static async #saveSettings(_event, _form, _formData) {
		const rules = this.#getRuleData();
		await setSetting('traitRules', rules);
	}
}

Hooks.once('setup', () => {
	game.settings.registerMenu(MODULE_ID, 'traitMusicMenu', {
		name: 'Trait Music Rules',
		label: 'Trait Rules',
		hint: 'Map PF2e traits to tracks that play when those creatures are in combat.',
		icon: 'fas fa-skull',
		type: TraitMusicManager,
		restricted: true,
	});
});
