declare global {
	interface LenientGlobalVariableTypes {
		canvas: never;
		game: never;
		socket: never;
		ui: never;
	}
	interface Window {
		ForgeVTT: any;
		CombatMusicMaster: any;
	}
}

export {};
