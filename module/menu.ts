import { getSetting, setSetting, SYSTEM_ID } from './settings.js';

export class PlaylistManager extends FormApplication<FormApplicationOptions, any, any> {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'combat-master-config',
			title: 'Combat Master',
			classes: ['sheet'],
			template: 'modules/combat-music-master/templates/config.html',
			width: 400,
			filters: [{ inputSelector: 'input[name="search"]', contentSelector: '.cmm-playlists' }],
		});
	}

	/**
	 * Get all game settings related to the form, to display them
	 * @param _options
	 */
	async getData(_options: any) {
		return {
			playlists: game.playlists!.contents.map((playlist) => ({
				playlist,
				active: playlist.getFlag(SYSTEM_ID, 'combat') || false,
				default: getSetting('defaultPlaylist') === playlist.id,
			})),
		};
	}

	/**
	 * Updates the settings to match the forms
	 * @param _event
	 * @param formData The form data to be saved
	 */
	protected async _updateObject(_event: Event, formData: { combat?: boolean[] | boolean }) {
		const playlists = game.playlists!.contents;
		if (formData.combat === undefined) return;

		if (typeof formData.combat === 'boolean') formData.combat = [formData.combat];
		if (playlists.length !== formData.combat.length) {
			ui.notifications.error(`Playlists changed while configuration window was on.`);
		}

		for (let i = 0; i < playlists.length; i++) {
			const playlist = playlists[i],
				active = formData.combat[i];
			if (playlist.getFlag(SYSTEM_ID, 'combat') != active) playlist.setFlag(SYSTEM_ID, 'combat', active);
		}
		const standard = this.element[0].querySelector('label.star')?.getAttribute('for') ?? '';
		setSetting('defaultPlaylist', standard);
	}

	protected _onSearchFilter(event, query, rgx, html) {
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

	protected _activateCoreListeners(html: JQuery<HTMLElement>): void {
		super._activateCoreListeners(html);
		function select(ev: PointerEvent) {
			ev.preventDefault();
			const target = ev.target as HTMLElement;
			const star = html[0].querySelector('label.star');
			const toggle = target.classList.toggle('star');
			if (star && star !== target) star.classList.remove('star');

			const id = target.getAttribute('for');
			if (toggle) (html[0].querySelector(`input#${id}`) as HTMLInputElement).checked = toggle;
		}
		function removeStar(ev: PointerEvent) {
			const target = ev.target as HTMLInputElement;
			const label = html[0].querySelector(`label[for=${target.id}]`);
			if (!target.checked) label!.classList.remove('star');
		}

		html[0].querySelectorAll('label.playlist-name').forEach((label) => label.addEventListener('click', select));
		html[0].querySelectorAll('input[name=combat]').forEach((label) => label.addEventListener('click', removeStar));
	}
}

Hooks.on('setup', () => {
	game.settings.registerMenu(SYSTEM_ID, 'combatMusicMenu', {
		name: 'Combat Music Master',
		label: 'Combat Playlists', // The text label used in the button
		hint: 'Select which ones are your combat playlists.',
		icon: 'fas fa-music', // A Font Awesome icon used in the submenu button
		type: PlaylistManager, // A FormApplication subclass which should be created
		restricted: true, // Restrict this submenu to gamemaster only?
	});
});
