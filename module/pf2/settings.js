import { MODULE_ID } from '../constants.js';

const settings = {
	traitRules: {
		name: 'Trait Music Rules',
		scope: 'world',
		config: false,
		type: Array,
		default: [],
	},
};

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting);
	}
});
