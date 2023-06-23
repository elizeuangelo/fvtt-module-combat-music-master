import { parseMusic, setCombatMusic, stringifyMusic, updateCombatMusic, updateTurnMusic } from './music-manager.js';
import { SYSTEM_ID } from './settings.js';
import { createOption } from './token.js';

class CombatTrackerMusicManager extends FormApplication<FormApplicationOptions, any, any> {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'combat-master-tracker',
			title: 'Combat Music Master',
			classes: ['sheet'],
			template: 'modules/combat-music-master/templates/tracker.html',
			width: 400,
		});
	}

	/**
	 * Get all game settings related to the form, to display them
	 * @param _options
	 */
	async getData(_options: any) {
		const selected = parseMusic(game.combat!.getFlag(SYSTEM_ID, 'overrideMusic') as string);
		const playlist = 'error' in selected ? undefined : ((selected?.parent ?? selected) as Playlist);
		const track = playlist === selected ? undefined : selected;

		const tracks = playlist ? playlist.sounds.contents : [];

		return {
			playlists: game
				.playlists!.contents.filter((p) => p.getFlag(SYSTEM_ID, 'combat'))
				.map((p) => ({ id: p.id, name: p.name, selected: p === playlist })),
			tracks: tracks.map((t) => ({ id: t.id, name: t.name, selected: t === track })),
		};
	}

	/**
	 * Updates the settings to match the forms
	 * @param _event
	 * @param formData The form data to be saved
	 */
	protected async _updateObject(_event: Event, formData: { playlist: string; track: string }) {
		const playlist = game.playlists!.get(formData.playlist);
		const track = playlist?.sounds.get(formData.track);
		const sound = stringifyMusic(track ?? playlist);

		game.combat
			?.update({
				[`flags.${SYSTEM_ID}.overrideMusic`]: sound,
			})
			.then(() => updateTurnMusic(game.combat!));
	}

	protected _activateCoreListeners(html: JQuery<HTMLElement>): void {
		super._activateCoreListeners(html);

		function selectPlaylist(ev) {
			const playlist = game.playlists!.get(ev.target.value);
			const tracks = playlist?.sounds.contents ?? [];

			html[0].querySelector('select[name=track]')!.innerHTML = [undefined, ...tracks]
				.map((track) => createOption(track))
				.join('');
		}

		html[0].querySelector('select[name=playlist]')!.addEventListener('change', selectPlaylist);
	}
}

const button = `
<a class="combat-button combat-control" data-tooltip="Set Encounter Music" data-control="musicManager">
<i class="fas fa-music"></i>
</a>`;

function clickButton() {
	new CombatTrackerMusicManager().render(true);
}

function addButton(encounter: CombatTracker, html: JQuery<HTMLElement>, data: CombatTracker.Data) {
	const title = html[0].querySelector('.encounter-title.noborder');
	const btn = $(button)[0];
	if (!game.combat) btn.setAttribute('disabled', '');
	btn.addEventListener('click', clickButton);
	title!.insertAdjacentElement('beforebegin', btn);
}

Hooks.on('renderCombatTracker', addButton);
