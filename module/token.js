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
    const sectionEl = $(section)[0];
    fillOptions(sectionEl.querySelector('select[name=playlist]'), [undefined, ...game.playlists.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat'))]);
    const footer = html[0].querySelector('footer.sheet-footer');
    footer.insertAdjacentElement('beforebegin', sectionEl);
    html[0].style.width = '560px';
}
Hooks.on('renderTokenConfig', addTab);
