import './module/settings.js';
import './module/menu.js';
import './module/encounter.js';
Hooks.once('ready', () => {
    if (game.user.isGM) {
        import('./module/music-manager.js');
        import('./module/token.js');
    }
});
