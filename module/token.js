import { parseMusic, updateCombatMusic, setTokenConfig, stringifyMusic, getCombatMusic } from './music-manager.js';
import { SYSTEM_ID } from './settings.js';
const menu = `<a class="item" data-tab="music-manager"><i class="fas fa-music"></i> Music</a>`;
let section = await getTemplate('modules/combat-music-master/templates/music-section.html');
export function createOption(sound) {
    return `<option value="${sound ? sound.id : ''}" ${sound?.selected ? 'selected' : ''}> ${sound ? sound.name : ''}</option>`;
}
function fillOptions(html, options) {
    html.innerHTML = options.map((opt) => createOption(opt)).join('');
}
let menuTab = false;
function addTab(tokenConfig, html, data) {
    const musicList = tokenConfig.token.getFlag(SYSTEM_ID, 'musicList') ?? [['', 100]];
    const resource = tokenConfig.token.getFlag(SYSTEM_ID, 'resource');
    data['trackedResource'] = resource
        ? tokenConfig.token.getBarAttribute?.('tracked-resource', {
            alternative: resource,
        })
        : tokenConfig.token.getBarAttribute('bar1');
    data['completeAttributes'] = { 'Attribute Bars': data.barAttributes['Attribute Bars'] };
    data['trackSelection'] = musicList.map((music, index) => ({ threshold: music[1], disabled: index === 0 }));
    data['musicPriority'] = tokenConfig.token.getFlag(SYSTEM_ID, 'priority') ?? 10;
    data['turnOnly'] = tokenConfig.token.getFlag(SYSTEM_ID, 'turnOnly') ?? false;
    html[0].querySelector('nav.sheet-tabs.tabs').appendChild($(menu)[0]);
    function selectPlaylist(ev) {
        const playlist = game.playlists.get(ev.target.value);
        const tracks = playlist?.sounds.contents ?? [];
        this.parentElement.parentElement.querySelector('select[name=track]').innerHTML = [undefined, ...tracks].map((track) => createOption(track)).join('');
    }
    function actionButton(event) {
        event.preventDefault();
        const priorityEl = sectionEl.querySelector('input[name=priority]');
        const priority = +priorityEl.value;
        const button = event.currentTarget;
        const action = button.dataset.action;
        game.tooltip.deactivate();
        const tracks = getMusicList().map(([sound, priority]) => [stringifyMusic(sound), priority]);
        switch (action) {
            case 'addTrack':
                tracks.push(['', tracks.length === 1 ? 50 : 0]);
                break;
            case 'removeTrack':
                let idx = +button.closest('.track-selection').dataset.index;
                tracks.splice(idx, 1);
                break;
        }
        tokenConfig._previewChanges({ [`flags.${SYSTEM_ID}`]: { musicList: tracks, priority, resource: resourceEl.value, turnOnly: turnOnlyEl.checked } });
        menuTab = true;
        tokenConfig.render();
    }
    function getMusicList() {
        const musicList = [];
        for (const el of musicListEls) {
            const threshold = +el.querySelector('input[name=threshold]').value;
            const playlistEl = el.querySelector('select[name=playlist]');
            const trackEl = el.querySelector('select[name=track]');
            const playlist = game.playlists.get(playlistEl.value);
            const track = playlist?.sounds.get(trackEl.value);
            musicList.push([track || playlist, threshold]);
        }
        return musicList;
    }
    function onSubmission(ev) {
        const priority = +priorityEl.value;
        const resource = resourceEl.value;
        const turnOnly = turnOnlyEl.checked;
        setTokenConfig(tokenConfig.token, resource, getMusicList(), priority, turnOnly);
    }
    const sectionEl = $(section(data, {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
    }))[0];
    const priorityEl = sectionEl.querySelector('input[name=priority]');
    const turnOnlyEl = sectionEl.querySelector('input[name=turn-only]');
    const resourceEl = sectionEl.querySelector('select[name=tracked-resource');
    const musicListEls = sectionEl.querySelectorAll('fieldset.track-selection');
    const formEl = (html[0].nodeName === 'FORM' ? html[0] : html[0].querySelector('form'));
    const combatPlaylists = getCombatMusic();
    for (let i = 0; i < musicListEls.length; i++) {
        const el = musicListEls[i];
        const playlistEl = el.querySelector('select[name=playlist]');
        const trackEl = el.querySelector('select[name=track]');
        const selected = parseMusic(musicList[i][0]);
        const playlist = 'error' in selected ? undefined : (selected?.parent ?? selected);
        const track = playlist === selected ? undefined : selected;
        const tracks = playlist ? playlist.sounds.contents : [];
        fillOptions(playlistEl, [undefined, ...combatPlaylists.map((p) => ({ id: p.id, name: p.name, selected: p === playlist }))]);
        fillOptions(trackEl, [undefined, ...tracks.map((p) => ({ id: p.id, name: p.name, selected: p === track }))]);
        playlistEl.addEventListener('change', selectPlaylist);
    }
    const footer = html[0].querySelector('footer.sheet-footer');
    footer.insertAdjacentElement('beforebegin', sectionEl);
    if (html[0].classList.contains('app')) {
        const width = tokenConfig.options.width + 80;
        html[0].style.width = `${width}px`;
        tokenConfig.position.width = width;
    }
    if (menuTab)
        tokenConfig.activateTab('music-manager');
    menuTab = false;
    sectionEl.querySelectorAll('a.action-button').forEach((el) => el.addEventListener('click', actionButton));
    resourceEl.addEventListener('change', tokenConfig._onBarChange.bind(tokenConfig));
    formEl.addEventListener('submit', onSubmission);
}
function resourceTracker(token) {
    const combatant = token.combatant;
    if (!combatant || !combatant.combat.started || combatant.combat.getFlag(SYSTEM_ID, 'token') !== token.id)
        return;
    const music = getTokenMusic(token);
    if (music)
        updateCombatMusic(combatant.combat, music);
}
export function getTokenMusic(token) {
    const attribute = foundry.utils.getProperty(token.actor.system, token.getFlag(SYSTEM_ID, 'resource'));
    const musicList = token.getFlag(SYSTEM_ID, 'musicList');
    if (!musicList)
        return;
    const attrThreshold = attribute.max === 0 ? 100 : (100 * attribute.value) / attribute.max;
    for (let i = musicList.length; i > 0; i--) {
        const [music, threshold] = musicList[i - 1];
        if (attrThreshold <= threshold) {
            return music;
        }
    }
}
Hooks.on('renderTokenConfig', addTab);
if (game.user.isGM)
    Hooks.on('updateToken', resourceTracker);
