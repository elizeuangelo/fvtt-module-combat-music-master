import './module/menu.js';
import './module/settings.js';
import './module/token.js';
import('./module/encounter.js');

Hooks.on('init', () => {
	if (game.system.id === 'pf2e') {
		import('./module/pf2/index.js');
	}
});
