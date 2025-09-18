import { parseMusic, stringifyMusic, updateTurnMusic } from './music-manager.mjs';
import { MODULE_ID } from './settings.mjs';
import { createOption } from './token.mjs';

class CombatTrackerMusicManager extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'combat-master-tracker',
      title: 'Combat Music Master',
      classes: ['sheet'],
      template: 'modules/combat-music-master/templates/tracker.hbs',
      width: 400
    });
  }

  async getData(_options) {
    const selected = parseMusic(game.combat.getFlag(MODULE_ID, 'overrideMusic'));
    const playlist = 'error' in selected ? undefined : (selected?.parent ?? selected);
    const track = playlist === selected ? undefined : selected;
    const tracks = playlist ? playlist.sounds.contents : [];
    return {
      playlists: game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat')).map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
      tracks: tracks.map((t) => ({ id: t.id, name: t.name, selected: t === track }))
    };
  }

  async _updateObject(_event, formData) {
    const playlist = game.playlists.get(formData.playlist);
    const track = playlist?.sounds.get(formData.track);
    const sound = stringifyMusic(track ?? playlist);
    game.combat
      ?.update({
        [`flags.${MODULE_ID}.overrideMusic`]: sound
      })
      .then(() => {
        if (game.combat.started) updateTurnMusic(game.combat);
      });
  }

  _activateCoreListeners(html) {
    super._activateCoreListeners(html);
    function selectPlaylist(ev) {
      const playlist = game.playlists.get(ev.target.value);
      const tracks = playlist?.sounds.contents ?? [];
      html[0].querySelector('select[name=track]').innerHTML = [undefined, ...tracks].map((track) => createOption(track)).join('');
    }
    html[0].querySelector('select[name=playlist]').addEventListener('change', selectPlaylist);
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
