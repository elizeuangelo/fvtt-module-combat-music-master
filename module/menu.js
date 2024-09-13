import { getSetting, setSetting, MODULE_ID } from './settings.js';

export class PlaylistManager extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'combat-master-config',
			title: 'Combat Master',
			classes: ['sheet'],
			template: 'modules/combat-music-master/templates/config.html',
			width: 400,
			filters: [{ inputSelector: 'input[name="search"]', contentSelector: '.cmm-playlists' }],
		});
	}

	async getData(_options) {
		return {
			playlists: game.playlists.contents.map((playlist) => ({
				playlist,
				active: playlist.getFlag(MODULE_ID, 'combat') || false,
				default: getSetting('defaultPlaylist') === playlist.id,
			})),
		};
	}

	async _updateObject(_event, formData) {
		const playlists = game.playlists.contents;
		if (formData.combat === undefined) return;
		if (typeof formData.combat === 'boolean') formData.combat = [formData.combat];
		if (playlists.length !== formData.combat.length) {
			ui.notifications.error(`Playlists changed while configuration window was on.`);
		}
		for (let i = 0; i < playlists.length; i++) {
			const playlist = playlists[i],
				active = formData.combat[i];
			if (playlist.getFlag(MODULE_ID, 'combat') != active) playlist.setFlag(MODULE_ID, 'combat', active);
		}
		const standard = this.element[0].querySelector('label.star')?.getAttribute('for') ?? '';
		setSetting('defaultPlaylist', standard);
	}

	_onSearchFilter(_event, query, rgx, html) {
		for (let li of html.children) {
			if (!query) {
				li.classList.remove('hidden');
				continue;
			}
			const name = (li.querySelector('.playlist-name')?.textContent || '').trim();
			const match = rgx.test(SearchFilter.cleanQuery(name));
			li.classList.toggle('hidden', !match);
		}
	}

	_activateCoreListeners(html) {
		super._activateCoreListeners(html);
		function select(ev) {
			ev.preventDefault();
			const target = ev.target;
			const star = html[0].querySelector('label.star');
			const toggle = target.classList.toggle('star');
			if (star && star !== target) star.classList.remove('star');
			const id = target.getAttribute('for');
			if (toggle) html[0].querySelector(`input#${id}`).checked = toggle;
		}
		function removeStar(ev) {
			const target = ev.target;
			const label = html[0].querySelector(`label[for=${target.id}]`);
			if (!target.checked) label.classList.remove('star');
		}
		html[0].querySelectorAll('label.playlist-name').forEach((label) => label.addEventListener('click', select));
		html[0].querySelectorAll('input[name=combat]').forEach((label) => label.addEventListener('click', removeStar));
	}
}

Hooks.once('setup', () => {
	game.settings.registerMenu(MODULE_ID, 'combatMusicMenu', {
		name: 'Combat Music Master',
		label: 'Combat Playlists',
		hint: 'Select which ones are your combat playlists.',
		icon: 'fas fa-music',
		type: PlaylistManager,
		restricted: true,
	});
});
