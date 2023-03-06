import { parseMusic, setTokenPriority } from './music-manager.js';
import { SYSTEM_ID } from './settings.js';
const menu = `<a class="item" data-tab="music-manager"><i class="fas fa-music"></i> Music</a>`;
const section = `<div class="tab" data-group="main" data-tab="music-manager">
    <div class="form-group">
        <label>Playlist</label>
        <select name="playlist">
            <option value=""> </option>
        </select>
        <p class="notes">Choose a playlist.</p>
    </div>

    <div class="form-group">
        <label>Track</label>
        <select name="track">
            <option value=""> </option>
        </select>
        <p class="notes">Choose a track.</p>
    </div>

    <div class="form-group slim">
        <label>Priority</label>
        <div class="form-fields">
            <input type="number" value="10" step="any" name="priority" placeholder="10">
        </div>
    </div>
</div>`;
export function createOption(sound) {
    return `<option value="${sound ? sound.id : ''}" ${sound?.selected ? 'selected' : ''}> ${sound ? sound.name : ''}</option>`;
}
function fillOptions(html, options) {
    html.innerHTML = options.map((opt) => createOption(opt)).join('');
}
function addTab(tokenConfig, html, data) {
    html[0].querySelector('nav.sheet-tabs.tabs').appendChild($(menu)[0]);
    function selectPlaylist(ev) {
        const playlist = game.playlists.get(ev.target.value);
        const tracks = playlist?.sounds.contents ?? [];
        html[0].querySelector('select[name=track]').innerHTML = [undefined, ...tracks].map((track) => createOption(track)).join('');
    }
    function onSubmission(ev) {
        const playlist = game.playlists.get(playlistEl.value);
        const track = playlist?.sounds.get(trackEl.value);
        const priority = +priorityEl.value;
        setTokenPriority(tokenConfig.token, track || playlist, priority);
    }
    const sectionEl = $(section)[0];
    const playlistEl = sectionEl.querySelector('select[name=playlist]');
    const trackEl = sectionEl.querySelector('select[name=track]');
    const priorityEl = sectionEl.querySelector('input[name=priority]');
    const selected = parseMusic(tokenConfig.token.getFlag(SYSTEM_ID, 'combatMusic'));
    const playlist = (selected?.parent ?? selected);
    const track = playlist === selected ? undefined : selected;
    const tracks = playlist ? playlist.sounds.contents : [];
    fillOptions(playlistEl, [
        undefined,
        ...game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat')).map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
    ]);
    fillOptions(trackEl, [undefined, ...tracks.map((p) => ({ id: p.id, name: p.name, selected: p === track }))]);
    const footer = html[0].querySelector('footer.sheet-footer');
    footer.insertAdjacentElement('beforebegin', sectionEl);
    html[0].style.width = '560px';
    playlistEl.addEventListener('change', selectPlaylist);
    html[0].addEventListener('submit', onSubmission);
}
Hooks.on('renderTokenConfig', addTab);
