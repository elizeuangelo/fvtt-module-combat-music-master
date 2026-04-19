import { getSetting, setSetting, MODULE_ID } from './settings.js';
import { stringifyMusic, getCombatMusic } from './music-manager.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TraitMusicManager extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'combat-master-trait-music',
		tag: 'form',
		window: {
			contentClasses: ['standard-form'],
			icon: 'fa-solid fa-music',
			title: 'Trait Music',
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

	// In-memory working copy so add/remove rows work without saving.
	#mappings = [];

	constructor(options = {}) {
		super(options);
		this.#mappings = TraitMusicManager.loadMappings();
	}

	static loadMappings() {
		try {
			return JSON.parse(getSetting('traitMappings')) ?? [];
		} catch {
			return [];
		}
	}

	_prepareContext() {
		const combatPlaylists = getCombatMusic();
		return {
			traitMappings: this.#mappings,
			combatPlaylists,
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.#populateAllPlaylists(context.combatPlaylists);
		this.#bindEvents();
	}

	#populateAllPlaylists(combatPlaylists) {
		this.element.querySelectorAll('.trait-music-row[data-index]').forEach((row) => {
			const index = parseInt(row.dataset.index);
			const mapping = this.#mappings[index];
			const playlistSelect = row.querySelector('select[name="playlist"]');

			playlistSelect.innerHTML = '<option value=""></option>';
			combatPlaylists.forEach((playlist) => {
				const option = document.createElement('option');
				option.value = playlist.id;
				option.textContent = playlist.name;
				option.selected = playlist.id === mapping?.playlistId;
				playlistSelect.appendChild(option);
			});

			if (mapping?.playlistId) {
				this.#populateTracks(row, mapping.playlistId, mapping.trackId);
			}
		});
	}

	#populateTracks(row, playlistId, selectedTrackId = '') {
		const trackSelect = row.querySelector('select[name="track"]');
		trackSelect.innerHTML = '<option value=""></option>';
		if (!playlistId) return;
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

	#bindEvents() {
		this.element.querySelector('[data-action="addRow"]')?.addEventListener('click', (e) => {
			e.preventDefault();
			this.#mappings.push({ trait: '', playlistId: '', trackId: '', priority: 10 });
			this.render(true);
		});

		this.element.querySelectorAll('[data-action="removeRow"]').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const index = parseInt(btn.closest('[data-index]').dataset.index);
				this.#mappings.splice(index, 1);
				this.render(true);
			});
		});

		this.element.querySelectorAll('select[name="playlist"]').forEach((select) => {
			select.addEventListener('change', (e) => {
				const row = e.target.closest('[data-index]');
				this.#populateTracks(row, e.target.value);
			});
		});
	}

	#collectFormData() {
		return [...this.element.querySelectorAll('.trait-music-row[data-index]')].map((row) => {
			const trait = row.querySelector('input[name="trait"]').value.trim().toLowerCase();
			const playlistId = row.querySelector('select[name="playlist"]').value;
			const trackId = row.querySelector('select[name="track"]').value;
			const priority = parseInt(row.querySelector('input[name="priority"]').value) || 10;
			const playlist = game.playlists.get(playlistId);
			const track = playlist?.sounds.get(trackId);
			const music = stringifyMusic(track ?? playlist);
			return { trait, playlistId, trackId, music, priority };
		}).filter((m) => m.trait && m.music);
	}

	static async #saveSettings(_event, _form, _formData) {
		const mappings = this.#collectFormData();
		await setSetting('traitMappings', JSON.stringify(mappings));
	}
}

Hooks.once('setup', () => {
	game.settings.registerMenu(MODULE_ID, 'traitMusicMenu', {
		name: 'Trait Music',
		label: 'Trait Music',
		hint: 'Map PF2e creature traits to music tracks.',
		icon: 'fas fa-skull',
		type: TraitMusicManager,
		restricted: true,
	});
});
