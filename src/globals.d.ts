/// <reference path="../node_modules/phaser/types/phaser.d.ts" />

// Phaser is loaded as a global from a plain <script> tag, never imported.
// The reference above brings in its types so `Phaser.*` is fully typed.
declare const Phaser: typeof import('phaser');
