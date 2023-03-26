import './module/settings.js';
import './module/menu.js';

Hooks.once('ready', () => {
	import('./module/token.js');
	if (game.user!.isGM) {
		import('./module/encounter.js');
	}
});
