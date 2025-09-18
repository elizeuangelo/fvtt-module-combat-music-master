import { parseMusic, stringifyMusic, updateTurnMusic } from './music-manager.mjs';
import { MODULE_ID } from './settings.mjs';
import { createOption } from './token.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CombatTrackerMusicManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'combat-master-tracker',
    tag: 'form',
    window: {
      title: 'Combat Music Master',
      resizable: false,
      minimizable: false
    },
    modal: true,
    classes: ['sheet'],
    form: {
      handler: CombatTrackerMusicManager.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    position: { width: 400, height: 'auto' }
  };

  /** @override */
  static PARTS = {
    form: { template: 'modules/combat-music-master/templates/tracker.hbs' }
  };

  /** @override */
  _prepareContext(options) {
    const selected = parseMusic(game.combat.getFlag(MODULE_ID, 'overrideMusic'));
    const playlist = 'error' in selected ? undefined : (selected?.parent ?? selected);
    const track = playlist === selected ? undefined : selected;
    const tracks = playlist ? playlist.sounds.contents : [];

    return {
      playlists: game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat')).map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
      tracks: tracks.map((t) => ({ id: t.id, name: t.name, selected: t === track }))
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Handle playlist selection change - replaces _activateCoreListeners
    const playlistSelect = this.element.querySelector('select[name=playlist]');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (ev) => {
        const playlist = game.playlists.get(ev.target.value);
        const tracks = playlist?.sounds.contents ?? [];
        const trackSelect = this.element.querySelector('select[name=track]');
        if (trackSelect) {
          trackSelect.innerHTML = [undefined, ...tracks].map((track) => createOption(track)).join('');
        }
      });
    }
  }

  /** @override */
  static async formHandler(event, form, formData) {
    const playlist = game.playlists.get(formData.object.playlist);
    const track = playlist?.sounds.get(formData.object.track);
    const sound = stringifyMusic(track ?? playlist);

    await game.combat?.update({
      [`flags.${MODULE_ID}.overrideMusic`]: sound
    });

    if (game.combat.started) {
      updateTurnMusic(game.combat);
    }

    return true;
  }
}

const button = `
<a class="combat-button combat-control" data-tooltip="Set Encounter Music" data-control="musicManager">
<i class="fas fa-music"></i>
</a>`;

function clickButton() {
  new CombatTrackerMusicManager().render(true);
}

function addButton(_encounter, html) {
  const title = html.querySelector('.encounter-title');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = button;
  const btn = tempDiv.firstElementChild;
  if (!game.combat) btn.setAttribute('disabled', '');
  btn.addEventListener('click', clickButton);
  title.insertAdjacentElement('beforebegin', btn);
}

Hooks.on('renderCombatTracker', addButton);
