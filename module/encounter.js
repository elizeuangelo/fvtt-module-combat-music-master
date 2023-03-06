import { parseMusic, setCombatMusic } from './music-manager.js';
import { SYSTEM_ID } from './settings.js';
import { createOption } from './token.js';
class CombatTrackerMusicManager extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'combat-master-tracker',
            title: 'Combat Music Master',
            classes: ['sheet'],
            template: 'modules/combat-music-master/templates/tracker.html',
            width: 400,
        });
    }
    async getData(_options) {
        const selected = parseMusic(game.combat.getFlag(SYSTEM_ID, 'overrideMusic'));
        const playlist = (selected?.parent ?? selected);
        const track = playlist === selected ? undefined : selected;
        const tracks = playlist ? playlist.sounds.contents : [];
        return {
            playlists: game
                .playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat'))
                .map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
            tracks: tracks.map((t) => ({ id: t.id, name: t.name, selected: t === track })),
        };
    }
    async _updateObject(_event, formData) {
        const playlist = game.playlists.get(formData.playlist);
        const track = playlist?.sounds.get(formData.track);
        setCombatMusic(track ?? playlist);
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
function addButton(encounter, html, data) {
    const title = html[0].querySelector('.encounter-title.noborder');
    const btn = $(button)[0];
    if (!game.combat)
        btn.setAttribute('disabled', '');
    btn.addEventListener('click', clickButton);
    title.insertAdjacentElement('beforebegin', btn);
}
Hooks.on('renderCombatTracker', addButton);
