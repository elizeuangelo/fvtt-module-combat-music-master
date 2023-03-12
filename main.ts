import './module/settings.js';
import './module/menu.js';

Hooks.once('ready', () => {
	if (game.user!.isGM) {
		import('./module/encounter.js');
		import('./module/music-manager.js');
		import('./module/token.js');
	}
});
