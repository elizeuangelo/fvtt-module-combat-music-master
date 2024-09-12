import './module/settings.js';
import './module/menu.js';
import './module/token.js';

Hooks.once('setup', () => {
	if (game.user.isGM) {
		import('./module/encounter.js');
	}
});
