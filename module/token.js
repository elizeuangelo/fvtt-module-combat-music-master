// TODO: Remove ALL jQuery from hooks as they now use HTMLElements
import { DEFAULT_TOKEN_MUSIC_PRIORITY, MODULE_ID } from './constants.js';
import {
	getCombatMusicList,
	getHighestPriority,
	parseMusic,
	pick,
	stringifyMusic,
	updateCombatMusic,
} from './music-manager.js';
import { getSetting } from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token Music Configuration Application
 */
class TokenMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'token-music-config',
		tag: 'form',
		window: {
			contentClasses: ['standard-form', 'token-config'],
			icon: 'fa-solid fa-music',
			title: 'Token Combat Music Configuration',
		},
		form: {
			closeOnSubmit: true,
			handler: TokenMusicConfig.#saveSettings,
		},
		position: { width: 500, height: 'auto' },
	};

	static PARTS = {
		body: { template: 'modules/combat-music-master/templates/music-section.hbs' },
		footer: { template: 'templates/generic/form-footer.hbs' },
	};

	constructor(token, options = {}) {
		super(options);
		this.token = token;
		this._preview = this._prepareData();
	}

	_prepareData() {
		const token = this.token;
		return {
			musicList: token.getFlag(MODULE_ID, 'musicList') ?? [['', 100]],
			resource: token.getFlag(MODULE_ID, 'resource'),
			priority: token.getFlag(MODULE_ID, 'priority') ?? DEFAULT_TOKEN_MUSIC_PRIORITY,
			active: token.getFlag(MODULE_ID, 'active') ?? false,
			turnOnly: token.getFlag(MODULE_ID, 'turnOnly') ?? false,
		};
	}

	_prepareSubmitData() {
		const active = this.element.querySelector('input[name="music-active"]').checked;
		const priority =
			parseInt(this.element.querySelector('input[name="priority"]').value) || DEFAULT_TOKEN_MUSIC_PRIORITY;
		const turnOnly = this.element.querySelector('input[name="turn-only"]').checked;
		const resource = this.element.querySelector('select[name="tracked-resource"]').value;
		const musicList = this.#getTrackData();
		return { musicList, resource, active, priority, turnOnly };
	}

	_previewChanges(data) {
		this._preview = { ...this._prepareSubmitData(), ...data };
	}

	_prepareContext(_options) {
		const token = this.token;
		const data = this._preview;
		const musicList = data.musicList;
		const resource = data.resource;
		const trackedResource = resource
			? token.getBarAttribute?.('tracked-resource', {
					alternative: resource,
				})
			: token.getBarAttribute('bar1');

		const trackSelection = musicList.map((music, index) => {
			const parsed = parseMusic(music[0]);
			const playlist = parsed.data?.playlist;
			const track = parsed.data?.track;
			return {
				threshold: music[1],
				disabled: index === 0,
				playlistId: playlist?.id ?? '',
				trackId: track?.id ?? '',
				error: 'error' in parsed ? parsed.message : '',
				flag: music[0] ?? '',
			};
		});

		const usesTrackableAttributes = !foundry.utils.isEmpty(CONFIG.Actor.trackableAttributes);
		const attributeSource =
			this.actor?.system instanceof foundry.abstract.DataModel && usesTrackableAttributes
				? this.actor?.type
				: this.actor?.system;
		const TokenDocument = foundry.utils.getDocumentClass('Token');
		const attributes = TokenDocument.getTrackedAttributes(attributeSource);
		const barAttributes = TokenDocument.getTrackedAttributeChoices(attributes);
		const completeAttributes = barAttributes.filter((attr) => attr.group === 'Attribute Bars');

		return {
			trackedResource,
			trackSelection,
			completeAttributes,
			musicPriority: data.priority,
			musicActive: data.active,
			turnOnly: data.turnOnly,
			isDefault: false,
			hasInvalidEntries: trackSelection.some((s) => !!s.error),
			buttons: [{ type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }],
		};
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.#populatePlaylistOptions(context);
		this.setupEventListeners();
	}

	#updateTracksForPlaylist(playlistSelect, playlistId, selectedTrackId = '') {
		const trackSelect = playlistSelect.parentElement.nextElementSibling?.querySelector('select[name="track"]');
		if (!trackSelect) return;

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

	#populatePlaylistOptions(context) {
		const combatPlaylists = getCombatMusicList();
		const playlistSelects = this.element.querySelectorAll('select[name="playlist"]');

		playlistSelects.forEach((select, index) => {
			const trackSelection = context.trackSelection[index];
			if (!trackSelection) return;

			select.innerHTML = '<option value=""></option>';
			combatPlaylists.forEach((playlist) => {
				const option = document.createElement('option');
				option.value = playlist.id;
				option.textContent = playlist.name;
				option.selected = playlist.id === trackSelection.playlistId;
				select.appendChild(option);
			});

			if (trackSelection.playlistId) {
				this.#updateTracksForPlaylist(select, trackSelection.playlistId, trackSelection.trackId);
			}
		});
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	setupEventListeners() {
		// Add track button
		this.element.querySelector('[data-action="addTrack"]')?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.#onAddTrack(event);
		});

		// Remove track buttons
		this.element.querySelectorAll('[data-action="removeTrack"]').forEach((button) => {
			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.#onRemoveTrack(event);
			});
		});

		this.element.querySelectorAll('[data-action="previewRow"]').forEach((button) => {
			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.#onPreviewRow(event);
			});
		});

		this.element.querySelectorAll('[data-action="stopRow"]').forEach((button) => {
			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.#onStopRow(event);
			});
		});

		// Playlist change handlers
		this.element.querySelectorAll('select[name="playlist"]').forEach((select) => {
			select.addEventListener('change', this.#onPlaylistChange.bind(this));
		});

		// Resource change handler
		this.element
			.querySelector('select[name="tracked-resource"]')
			?.addEventListener('change', this.#onChangeBar.bind(this));

		this.element.querySelector('[data-action="previewTokenRule"]')?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.#onPreviewTokenRule();
		});

		this.element.querySelector('[data-action="applyToControlled"]')?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.#onApplyToControlled();
		});
	}

	/**
	 * Handle changing the attribute bar in the drop-down selector to update the default current and max value
	 * @param {Event & { target: HTMLInputElement }} event  The select input change event
	 */
	#onChangeBar(event) {
		const form = this.form;
		const attr = this.token.getBarAttribute('', { alternative: event.target.value });
		const barName = event.target.name;
		form.querySelector(`input[data-${barName}-value]`).value = attr !== null ? attr.value : '';
		form.querySelector(`input[data-${barName}-max]`).value = attr !== null && attr.type === 'bar' ? attr.max : '';
	}

	#onPlaylistChange(event) {
		this.#updateTracksForPlaylist(event.target, event.target.value);
	}

	#getTrackData() {
		const trackData = [];
		const trackSelections = this.element.querySelectorAll('fieldset.track-selection');

		trackSelections.forEach((el) => {
			const threshold = parseInt(el.querySelector('input[name="threshold"]').value) || 0;
			const playlistEl = el.querySelector('select[name="playlist"]');
			const trackEl = el.querySelector('select[name="track"]');

			const playlist = game.playlists.get(playlistEl.value);
			const track = playlist?.sounds.get(trackEl.value);

			trackData.push([stringifyMusic(track || playlist), threshold]);
		});

		return trackData;
	}

	async #onAddTrack(event) {
		event.preventDefault();
		const musicList = this.#getTrackData();
		const newThreshold = ~~(musicList.at(-1)[1] / 2);
		musicList.push(['', newThreshold]);
		this._previewChanges({ musicList });
		this.render(true);
	}

	async #onRemoveTrack(event) {
		event.preventDefault();
		const trackSelection = event.target.closest('.track-selection');
		const index = parseInt(trackSelection.dataset.index);

		const musicList = this.#getTrackData();

		// Remove track at index
		musicList.splice(index, 1);

		this._previewChanges({ musicList });
		this.render(true);
	}

	#onPreviewTokenRule() {
		const token = this.token;
		const currentRuleMusic = getTokenMusic(token);
		const parsed = parseMusic(currentRuleMusic);
		if (!parsed.data) {
			ui.notifications.warn(`Combat Music Master: No valid music selected for "${token.name}".`);
			return;
		}
		const musicName = parsed.data.track
			? `${parsed.data.playlist.name} / ${parsed.data.track.name}`
			: parsed.data.playlist.name;
		ui.notifications.info(`Combat Music Master Preview: ${token.name} -> ${musicName}`);
	}

	#onPreviewRow(event) {
		const row = event.target.closest('.track-selection');
		const index = Number(row?.dataset?.index);
		if (Number.isNaN(index)) return;
		const data = this.#getTrackData();
		const music = data[index]?.[0];
		const parsed = parseMusic(music);
		if (!parsed.data) {
			ui.notifications.warn(`Combat Music Master: This row has no valid track/playlist (${parsed.error}).`);
			return;
		}
		const label = parsed.data.track
			? `${parsed.data.playlist.name} / ${parsed.data.track.name}`
			: parsed.data.playlist.name;
		ui.notifications.info(`Combat Music Master Row Preview: ${label}`);
		if (parsed.data.track) parsed.data.playlist.playSound(parsed.data.track);
		else parsed.data.playlist.playAll();
	}

	async #onStopRow(event) {
		const row = event.target.closest('.track-selection');
		const index = Number(row?.dataset?.index);
		if (Number.isNaN(index)) return;
		const data = this.#getTrackData();
		const music = data[index]?.[0];
		const parsed = parseMusic(music);
		if (!parsed.data) return;
		if (parsed.data.track) parsed.data.playlist.stopSound(parsed.data.track);
		else parsed.data.playlist.stopAll();
	}

	async #onApplyToControlled() {
		const controlled = canvas?.tokens?.controlled?.map((t) => t.document).filter(Boolean) ?? [];
		if (controlled.length <= 1) {
			ui.notifications.warn('Combat Music Master: Select at least two tokens to batch apply settings.');
			return;
		}
		const data = this._prepareSubmitData();
		const targets = controlled.filter((doc) => doc.id !== this.token.id);
		await Promise.all(targets.map((token) => token.update({ [`flags.${MODULE_ID}`]: data })));
		ui.notifications.info(`Combat Music Master: Applied settings to ${targets.length} controlled token(s).`);
	}

	/**
	 * @this {TokenMusicConfig}
	 */
	static async #saveSettings(_event, _form, _formData) {
		const data = this._prepareSubmitData();
		await this.token.update({ [`flags.${MODULE_ID}`]: data });
	}
}

export function createOption(sound) {
	return `<option value="${sound ? sound.id : ''}" ${sound?.selected ? 'selected' : ''}> ${
		sound ? sound.name : ''
	}</option>`;
}

export function getTokenHeaderButtons(sheet, buttons) {
	try {
		if (!game.user.isGM) return;
		buttons.unshift({
			label: 'Combat Music',
			class: 'configure-combat-music',
			icon: 'fas fa-music',
			onClick: () => new TokenMusicConfig(sheet.token).render(true),
		});
	} catch (error) {
		console.error('Combat Music Master | Error adding actor sheet header buttons:', error);
	}
}

export function getTokenMusic(token) {
	const active = token.getFlag(MODULE_ID, 'active');
	if (!active) return;

	const attribute = token.actor?.system?.attributes?.hp ?? token.getBarAttribute('bar1');
	const musicList = token.getFlag(MODULE_ID, 'musicList');
	if (!musicList) return;
	if (musicList.filter((x) => x[0]).length === 0) return;

	if (attribute.value > attribute.max) attribute.value = attribute.max;
	const attrThreshold = attribute === undefined || !attribute.max ? 100 : (100 * attribute.value) / attribute.max;

	for (let i = musicList.length; i > 0; i--) {
		const [music, threshold] = musicList[i - 1];
		if (attrThreshold <= threshold) {
			if (music === '') {
				const base = getSetting('defaultPlaylist');
				const combatPlaylists = new Map(
					getCombatMusicList().map((p) => [{ token: '', music: p.id }, +(p.id === base)]),
				);
				return pick(getHighestPriority(combatPlaylists)).music;
			}
			return music;
		}
	}
}

function resourceTracker(actor) {
	if (!game.combat?.started) return;
	const musicToken = game.combat.getFlag(MODULE_ID, 'token');
	const token = actor.token;
	if (!musicToken || !token || musicToken !== token.id) return;
	const combatant = token.combatant;
	if (combatant.combat.getFlag(MODULE_ID, 'token') !== token.id) return;
	const music = getTokenMusic(token);
	if (music) updateCombatMusic(combatant.combat, music);
}

Hooks.once('setup', () => {
	if (game.user.isGM) {
		Hooks.on('updateActor', resourceTracker);
		Hooks.on('updateToken', (token) => resourceTracker(token.actor));
	}
});
Hooks.on('getHeaderControlsTokenApplication', getTokenHeaderButtons);

function getConfigToken(app) {
	return app?.token ?? app?.object ?? app?.document ?? null;
}

function injectDirectTokenConfigButton(app, html) {
	try {
		if (!game.user.isGM) return;
		const token = getConfigToken(app);
		if (!token) return;
		if (html.querySelector('.cmm-direct-config-row') || html.querySelector('.cmm-direct-active-row')) return;

		const targetGroup =
			html.querySelector('[name="name"]')?.closest('.form-group') ??
			html.querySelector('.tab .form-group') ??
			html.querySelector('.tab');
		if (!targetGroup) return;

		const activeRow = document.createElement('div');
		activeRow.className = 'form-group cmm-direct-active-row';
		activeRow.innerHTML = `
			<label>Use Token Music</label>
			<div class="form-fields">
				<input type="checkbox" class="cmm-direct-active-toggle" ${token.getFlag(MODULE_ID, 'active') ? 'checked' : ''} />
			</div>
			<p class="hint">Enable token-specific combat music rules for this token.</p>
		`;

		const configRow = document.createElement('div');
		configRow.className = 'form-group cmm-direct-config-row';
		configRow.innerHTML = `
			<label>Combat Music</label>
			<div class="form-fields">
				<button type="button" class="cmm-direct-config-btn">
					<i class="fas fa-music"></i> Open Combat Music
				</button>
			</div>
			<p class="hint">Direct access to token combat music configuration.</p>
		`;

		const toggle = activeRow.querySelector('.cmm-direct-active-toggle');
		toggle?.addEventListener('change', async (event) => {
			try {
				// @ts-ignore
				await token.update({ [`flags.${MODULE_ID}.active`]: !!event.currentTarget.checked });
			} catch (error) {
				console.error('Combat Music Master | Failed to toggle token music active flag:', error);
			}
		});

		const button = configRow.querySelector('.cmm-direct-config-btn');
		button?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			new TokenMusicConfig(token).render(true);
		});

		targetGroup.insertAdjacentElement('afterend', configRow);
		targetGroup.insertAdjacentElement('afterend', activeRow);
		app.setPosition?.({ height: 'auto' });
	} catch (error) {
		console.error('Combat Music Master | Failed to inject direct token config button:', error);
	}
}

Hooks.on('renderTokenConfig', injectDirectTokenConfigButton);
Hooks.on('renderPrototypeTokenConfig', injectDirectTokenConfigButton);
