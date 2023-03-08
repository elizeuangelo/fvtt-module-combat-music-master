# Foundry VTT - 🎹 Combat Music Master

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/elizeuangelo/fvtt-module-combat-music-master)
![GitHub Releases](https://img.shields.io/github/downloads/elizeuangelo/fvtt-module-combat-music-master/latest/total)
![GitHub All Releases](https://img.shields.io/github/downloads/elizeuangelo/fvtt-module-combat-music-master/total?label=downloads)

Control your battle music! Automatically play songs amongst your combat playlists when combat starts.

## How does it work?

Everytime combat starts the module checks for the highest priority playlist for the encounter, with this simple rules:

-   All Combat Playlists have priority zero
-   The default playlist, if set, has priority 1
-   Every token can have their own associated playlist or music with a set priority, this means every token can affect the music played
-   You can override everything by configuring a music for the encounter

## Installation

In the setup screen, use the manifest URL https://raw.githubusercontent.com/elizeuangelo/fvtt-module-combat-music-master/master/module.json to install the module.

## How to Use

First things first! Let's start by configuring the module, so the module knows what playlists are your _Combat Playlists_.

There is a new button in the encounter tracker for overring the battle music for a specific encounter.

In the Token Configuration application there is a new Music tab, so you can configure specific music and priority for the token.
