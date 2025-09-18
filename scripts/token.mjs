// TODO: Remove ALL jQuery from hooks as they now use HTMLElements
import { parseMusic, updateCombatMusic, setTokenConfig, stringifyMusic, getCombatMusic, getHighestPriority, pick } from './music-manager.mjs';
import { MODULE_ID, getSetting } from './settings.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token Music Configuration Application
 */
export class TokenMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'token-music-config',
    tag: 'form',
    window: {
      title: 'Token Music Configuration',
      resizable: false,
      minimizable: false
    },
    modal: true,
    classes: ['sheet'],
    form: {
      handler: TokenMusicConfig.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    position: { width: 500, height: 'auto' }
  };

  static PARTS = {
    form: { template: 'modules/combat-music-master/templates/music-section.hbs' }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  /** @override */
  _prepareContext(options) {
    const musicList = this.actor.getFlag(MODULE_ID, 'musicList') ?? [['', 100]];
    const trackedResource = this.actor?.system?.attributes?.hp || { value: 0, max: 0 };

    const trackSelection = musicList.map((music, index) => ({
      threshold: music[1],
      disabled: false,
      playlistId: parseMusic(music[0])?.parent?.id || parseMusic(music[0])?.id || '',
      trackId: parseMusic(music[0])?.id || ''
    }));

    return {
      trackedResource,
      trackSelection,
      musicPriority: this.actor.getFlag(MODULE_ID, 'priority') ?? 10,
      musicActive: this.actor.getFlag(MODULE_ID, 'active') ?? false,
      turnOnly: this.actor.getFlag(MODULE_ID, 'turnOnly') ?? false,
      isDefault: false
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.populatePlaylistOptions(context);
  }

  setupEventListeners() {
    // Add track button
    this.element.querySelector('[data-action="addTrack"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onAddTrack(event);
    });

    // Remove track buttons
    this.element.querySelectorAll('[data-action="removeTrack"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onRemoveTrack(event);
      });
    });

    // Playlist change handlers
    this.element.querySelectorAll('select[name="playlist"]').forEach((select) => {
      select.addEventListener('change', this.onPlaylistChange.bind(this));
    });
  }

  populatePlaylistOptions(context) {
    const combatPlaylists = getCombatMusic();
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
        this.updateTracksForPlaylist(select, trackSelection.playlistId, trackSelection.trackId);
      }
    });
  }

  onPlaylistChange(event) {
    this.updateTracksForPlaylist(event.target, event.target.value);
  }

  updateTracksForPlaylist(playlistSelect, playlistId, selectedTrackId = '') {
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

  async onAddTrack(event) {
    event.preventDefault();
    const musicList = this.actor.getFlag(MODULE_ID, 'musicList') ?? [['', 100]];

    // Add new track with a lower threshold
    const newThreshold = musicList.length === 0 ? 100 : 50;
    musicList.push(['', newThreshold]);

    await this.actor.setFlag(MODULE_ID, 'musicList', musicList);
    console.error('ACTOR UPDATE:', { actorFlags: this.actor.flags });
    this.render(true);
  }

  async onRemoveTrack(event) {
    event.preventDefault();
    const trackSelection = event.target.closest('.track-selection');
    const index = parseInt(trackSelection.dataset.index);

    const musicList = this.actor.getFlag(MODULE_ID, 'musicList') ?? [['', 100]];

    // Remove track at index
    musicList.splice(index, 1);

    await this.actor.setFlag(MODULE_ID, 'musicList', musicList);
    console.error('ACTOR UPDATE:', { actorFlags: this.actor.flags });
    this.render(true);
  }

  getMusicList() {
    const musicList = [];
    const trackSelections = this.element.querySelectorAll('fieldset.track-selection');

    trackSelections.forEach((el) => {
      const threshold = parseInt(el.querySelector('input[name="threshold"]').value) || 0;
      const playlistEl = el.querySelector('select[name="playlist"]');
      const trackEl = el.querySelector('select[name="track"]');

      const playlist = game.playlists.get(playlistEl.value);
      const track = playlist?.sounds.get(trackEl.value);

      musicList.push([track || playlist, threshold]);
    });

    return musicList;
  }

  static async formHandler(event, form, formData) {
    const formDataObj = formData.object;

    const active = formDataObj['music-active'] || false;
    const priority = parseInt(formDataObj.priority) || 10;
    const turnOnly = formDataObj['turn-only'] || false;

    const musicList = this.getMusicList();

    // Use setFlag instead of update
    await this.actor.setFlag(MODULE_ID, {
      active,
      priority,
      musicList: musicList.map(([sound, threshold]) => [stringifyMusic(sound), threshold]),
      turnOnly
    });
    console.error('ACTOR UPDATE:', { actorFlags: this.actor.flags });
  }
}

export function createOption(sound) {
  return `<option value="${sound ? sound.id : ''}" ${sound?.selected ? 'selected' : ''}> ${sound ? sound.name : ''}</option>`;
}

export function getActorSheetHeaderControls(sheet, buttons) {
  try {
    if (!game.user.isGM) return;
    buttons.unshift({
      label: 'Combat Music',
      class: 'configure-combat-music',
      icon: 'fas fa-music',
      onClick: (event) => {
        event.preventDefault();
        new TokenMusicConfig(sheet.document).render(true);
      }
    });
  } catch (error) {
    console.error('Combat Music Master | Error adding actor sheet header controls:', error);
  }
}

export function getActorSheetHeaderButtons(sheet, buttons) {
  try {
    if (!game.user.isGM) return;
    buttons.unshift({
      label: 'Combat Music',
      class: 'configure-combat-music',
      icon: 'fas fa-music',
      onclick: (ev) => new TokenMusicConfig(sheet.document).render(true)
    });
  } catch (error) {
    console.error('Combat Music Master | Error adding actor sheet header buttons:', error);
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

export function getTokenMusic(token) {
  const active = token.getFlag(MODULE_ID, 'active');
  if (!active) return;

  const attribute = token.actor?.system?.attributes?.hp ?? token.getBarAttribute('bar1');
  const musicList = token.getFlag(MODULE_ID, 'musicList');
  if (!musicList) return;

  if (attribute.value > attribute.max) attribute.value = attribute.max;
  const attrThreshold = attribute === undefined || !attribute.max ? 100 : (100 * attribute.value) / attribute.max;

  for (let i = musicList.length; i > 0; i--) {
    const [music, threshold] = musicList[i - 1];
    if (attrThreshold <= threshold) {
      if (music === '') {
        const base = getSetting('defaultPlaylist');
        const combatPlaylists = new Map(getCombatMusic().map((p) => [{ token: '', music: p.id }, +(p.id === base)]));
        return pick(getHighestPriority(combatPlaylists)).music;
      }
      return music;
    }
  }
}

Hooks.once('setup', () => {
  if (game.user.isGM) {
    Hooks.on('updateActor', resourceTracker);
    Hooks.on('updateToken', (token) => resourceTracker(token.actor));
  }
});
