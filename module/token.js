import {
	parseMusic,
	updateCombatMusic,
	setTokenConfig,
	stringifyMusic,
	getCombatMusic,
	getHighestPriority,
	pick,
} from './music-manager.js';
import { MODULE_ID, getSetting } from './settings.js';

const menu = `<a data-action="tab" data-group="sheet" data-tab="music"><i class="fa-solid fa-music" inert></i> <span>Music</span></a>`;
let section;

export function createOption(sound) {
	return `<option value="${sound ? sound.id : ''}" ${sound?.selected ? 'selected' : ''}> ${
		sound ? sound.name : ''
	}</option>`;
}

function fillOptions(html, options) {
	html.innerHTML = options.map((opt) => createOption(opt)).join('');
}

function addNewTrackSelectionRow(targetElement, trackData) {
	const clone = targetElement.cloneNode(true);
	const index = targetElement.parentElement.querySelectorAll('fieldset.track-selection').length;
	clone.dataset.index = index;
	clone.querySelector('select[name=playlist]').value = trackData[0]?.parent?.id ?? '';
	clone.querySelector('select[name=track]').value = trackData[0]?.id ?? '';
	clone.querySelector('input[name=threshold]').value = trackData[1] ?? 0;
	targetElement.parentElement.appendChild(clone);
	return clone;
}

function addTab(tokenConfig, html, data) {
	const token = tokenConfig._preview;
	const musicList = token.getFlag(MODULE_ID, 'musicList') ?? [['', 100]];
	const resource = token.getFlag(MODULE_ID, 'resource');
	data['trackedResource'] = resource
		? token.getBarAttribute?.('tracked-resource', {
				alternative: resource,
		  })
		: token.getBarAttribute('bar1');
	data['completeAttributes'] = data.barAttributes.filter((attr) => attr.group === 'Attribute Bars');
	data['trackSelection'] = musicList.map((music, index) => ({ threshold: music[1], disabled: index === 0 }));
	data['musicPriority'] = token.getFlag(MODULE_ID, 'priority') ?? 10;
	data['musicActive'] = token.getFlag(MODULE_ID, 'active') ?? false;
	data['turnOnly'] = token.getFlag(MODULE_ID, 'turnOnly') ?? false;
	const menuEl = $(menu)[0];
	html.querySelector('nav.sheet-tabs.tabs').appendChild(menuEl);

	function selectPlaylist(ev) {
		const playlist = game.playlists.get(ev.target.value);
		const tracks = playlist?.sounds.contents ?? [];
		this.parentElement.parentElement.querySelector('select[name=track]').innerHTML = [undefined, ...tracks]
			.map((track) => createOption(track))
			.join('');
	}

	function actionButton(event) {
		event.preventDefault();
		const priorityEl = sectionEl.querySelector('input[name=priority]');
		const rowEl = button.closest('.track-selection');
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
				let idx = +rowEl.dataset.index;
				tracks.splice(idx, 1);
				rowEl.remove();
				break;
		}
		tokenConfig._previewChanges({
			[`flags.${MODULE_ID}`]: {
				musicList: tracks,
				priority,
				resource: resourceEl.value,
				turnOnly: turnOnlyEl.checked,
			},
		});
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

	function onSubmission() {
		const active = activeEl.checked;
		const priority = +priorityEl.value;
		const resource = resourceEl.value;
		const turnOnly = turnOnlyEl.checked;
		setTokenConfig(tokenConfig.token, resource, getMusicList(), priority, turnOnly, active);
	}

	const sectionEl = $(
		section(data, {
			allowProtoMethodsByDefault: true,
			allowProtoPropertiesByDefault: true,
		})
	)[0];
	const activeEl = sectionEl.querySelector('input[name=music-active]');
	const priorityEl = sectionEl.querySelector('input[name=priority]');
	const turnOnlyEl = sectionEl.querySelector('input[name=turn-only]');
	const resourceEl = sectionEl.querySelector('select[name=tracked-resource');
	const musicListEls = sectionEl.querySelectorAll('fieldset.track-selection');
	const formEl = html.nodeName === 'FORM' ? html : html.querySelector('form');
	const combatPlaylists = getCombatMusic();
	for (let i = 0; i < musicListEls.length; i++) {
		const el = musicListEls[i];
		const playlistEl = el.querySelector('select[name=playlist]');
		const trackEl = el.querySelector('select[name=track]');
		const selected = parseMusic(musicList[i][0]);
		const playlist = 'error' in selected ? undefined : selected?.parent ?? selected;
		const track = playlist === selected ? undefined : selected;
		const tracks = playlist ? playlist.sounds.contents : [];
		fillOptions(playlistEl, [
			undefined,
			...combatPlaylists.map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
		]);
		fillOptions(trackEl, [undefined, ...tracks.map((p) => ({ id: p.id, name: p.name, selected: p === track }))]);
		playlistEl.addEventListener('change', selectPlaylist);
	}
	const footer = html.querySelector('footer.form-footer');
	footer.insertAdjacentElement('beforebegin', sectionEl);
	if (html.classList.contains('app')) {
		const width = tokenConfig.options.width + 80;
		html.style.width = `${width}px`;
		tokenConfig.position.width = width;
	}
	if (tokenConfig.tabGroups.sheet === 'music') {
		menuEl.classList.add('active');
		sectionEl.classList.add('active');
	}
	sectionEl.querySelectorAll('a.action-button').forEach((el) => el.addEventListener('click', actionButton));
	resourceEl.addEventListener('change', tokenConfig._onChangeBar.bind(tokenConfig));
	formEl.addEventListener('submit', onSubmission);
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
	const attribute =
		foundry.utils.getProperty(token.actor.system, token.getFlag(MODULE_ID, 'resource')) ??
		token.getBarAttribute('bar1');
	const musicList = token.getFlag(MODULE_ID, 'musicList');
	if (!musicList) return;
	if (attribute.value > attribute.max) attribute.value = attribute.max;
	const attrThreshold = attribute === undefined || !attribute.max ? 100 : (100 * attribute.value) / attribute.max;
	for (let i = musicList.length; i > 0; i--) {
		const [music, threshold] = musicList[i - 1];
		if (attrThreshold <= threshold) {
			if (music === '') {
				const base = getSetting('defaultPlaylist');
				const combatPlaylists = new Map(
					getCombatMusic().map((p) => [{ token: '', music: p.id }, +(p.id === base)])
				);
				return pick(getHighestPriority(combatPlaylists)).music;
			}
			return music;
		}
	}
}

Hooks.once('setup', async () => {
	section = await foundry.applications.handlebars.getTemplate(
		'modules/combat-music-master/templates/music-section.hbs'
	);
	Hooks.on('renderTokenConfig', addTab);
	if (game.user.isGM) {
		Hooks.on('updateActor', resourceTracker);
		Hooks.on('updateToken', (token) => resourceTracker(token.actor));
	}
});
