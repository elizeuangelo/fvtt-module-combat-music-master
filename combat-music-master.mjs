import './scripts/settings.mjs';
import './scripts/menu.mjs';
import './scripts/token.mjs';

Hooks.once('setup', () => {
  if (game.user.isGM) import('./scripts/encounter.mjs');
});
