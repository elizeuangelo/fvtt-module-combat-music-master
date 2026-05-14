import './module/settings.js';
import './module/menu.js';
import './module/token.js';
import('./module/encounter.js').catch((error) => {
	console.error('Combat Music Master | Failed to load encounter controls.', error);
	ui.notifications?.warn('Combat Music Master: Encounter controls failed to load. Check console for details.');
});
