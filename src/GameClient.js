import { createApp, reactive } from 'vue';
import UserInterface from './components/UserInterface.vue';
// import { PseudoRandomizer } from 'rocket-utility-belt';
import zzfx from './libs/ZzFXMicro.min.esm.js';
import PseudoRandomizer from './libs/PseudoRandomizer.js';
import GameWorldSim from './GameWorldSim.js';
import Planet from './Planet.js';
import noise from './libs/noise.js';
import {
	uid, Vector2, clamp,
} from './utils.js';
import { payBuildRecipe } from './inventoryUtils.js';
import GameRenderer from './GameRenderer.js';

const { floor, PI } = Math;

const FIRE_CARBON_COST = 128;

const MOVE_MODE_CARDINAL = 0;
const MOVE_MODE_FACING = 1;
const CARDINAL = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};
const FACING_ACTIONS = {
	up: 'forward',
	down: 'back',
	left: 'strafeLeft',
	right: 'strafeRight',
};
const INV_INTERFACE = 'inv';
const BUILD_INTERFACE = 'build';
const INTRO_INTERFACE = 'intro';
const WIN_INTERFACE = 'win';

const todaysSeed = PseudoRandomizer.getPseudoRandInt(Number(new Date()), 1000);

export default class GameClient {
	constructor() {
		this.nomad = {
			id: uid(),
			name: 'Norman',
		};
		this.localGameWorldSim = null;
		this.interface = reactive({ open: null, nomad: null, world: null });
		this.ctx = null;
		this.world = null;
		// this.camera = new Vector2(0, 0);
		this.lastChunkOn = { x: null, y: null };
		this.aimingVector = new Vector2(0, 0);
		this.moveMode = MOVE_MODE_FACING;
		this.placingWhat = null;
		this.isMouseDown = false;
		this.isDrilling = false;
		this.introIndex = 0;
		this.soundOn = true;
		this.moveCounter = 0;
		this.renderer = new GameRenderer({
			getClientRenderData: () => this.getClientRenderData(),
			GameClient,
			Planet,
		});

		noise.seed(todaysSeed); // TODO: Move this to Planet
	}

	getClientRenderData() {
		return {
			nomad: this.world.nomad,
			world: this.world,
			aimingVector: this.aimingVector,
			isInterfaceOpen: Boolean(this.interface.open),
			toolOverheat: this.getToolOverheat(),
			isDrilling: this.isDrilling,
		};
	}

	playSound(p) {
		if (!this.soundOn) return;
		if (p instanceof Array) {
			zzfx(...p);
			return;
		}
		const SOUNDS = {
			/* eslint-disable */
			walk: [.2,,146.8324,,.01,.001,,0,5,,,,,1.9,,.5,,.91,.05,,-2446],
			// Cancel/blocked - [1.2,,31,.03,.1,.03,2,3.2,,6,,,.08,2,,.1,.14,.84,.08,.28,-2439]
			// blocked - [1.3,,139,.03,.01,.22,4,3.8,,,,,,.5,,.1,.02,.69,.04,.48,-2443]
			// Robospeak - [2.3,,195,.03,.09,.26,2,3.5,,,,,,.3,,.1,.11,.43,.05]
			gameGo: [0.6,,343,.09,.26,.35,,.8,,-24,-174,.09,.06,,,.1,,.69,.14],
			zip: [1.7,,376,,.01,.02,2,4.6,,-3,4,.21,,.1,8.9,,.32,.6,.03,,101],
			dud: [1,,376,.03,.05,.05,3,.7,10,17,,,.03,.4,.6,.2,.1,.96,.1,.06,-1315],
			jets: [.2,,271,.02,.02,.06,4,.2,,-18,,,,,,.1,,.53,.07],
			thrust: [.2,,110,.07,.08,.43,4,1.7,,,,,,.8,,1.7,.16,0,.25,,1953],
			// beat: [1.08,,99,.05,.21,.21,,.97,-0.1,5,,,.04,-0.1,1,.1,,.42,.25,.32],
			zup: [1.7,,674,.04,.26,.07,,2.1,-6,,-149,.05,.06,,,.1,.17,.56,.23,,-517],
			/* eslint-enable */
		};
		if (SOUNDS[p]) zzfx(...SOUNDS[p]);
	}

	sendAction(actionName, details) {
		this.localGameWorldSim.addAction(
			[actionName, this.nomad.id, { ...details, tick: this.world.tick }],
		);
	}

	moveNomad(arrow) {
		this.moveCounter += 1;
		const { nomad } = this.world;
		if (nomad.flying) {
			this.playSound('thrust');
		} else if (this.moveCounter % 10 === 0) {
			this.playSound('walk');
		}
		if (this.moveMode === MOVE_MODE_CARDINAL) {
			this.sendAction('move', { ...CARDINAL[arrow] });
			return;
		}
		this.sendAction(FACING_ACTIONS[arrow]);
	}

	turnNomad(angle) {
		if (angle === this.world.nomad.angle) return;
		this.sendAction('turn', { angle });
	}

	toggleMoveMode() {
		this.moveMode = (this.moveMode === MOVE_MODE_FACING) ? MOVE_MODE_CARDINAL : MOVE_MODE_FACING;
	}

	/** Convert DOM x y coordinates to world coordinates relative to the center of the screen */
	getScreenVector({ x, y }) {
		const { screen } = this.renderer;
		const screenCenter = screen.getPageCenter();
		return new Vector2(
			floor((x - screenCenter.x) / screen.sizeMultiplier),
			floor((y - screenCenter.y) / screen.sizeMultiplier),
		);
	}

	convertCenterCoordinatesToWorldCoordinates({ x, y }) {
		return new Vector2(x + this.renderer.camera.x, y + this.renderer.camera.y);
	}

	checkInputs() {
		this.isDrilling = false;
		if (this.interface.open) return;
		if (this.isMouseDown) {
			const { nomad } = this.world;
			const worldCoords = this.convertCenterCoordinatesToWorldCoordinates(this.aimingVector);
			if (this.placingWhat) {
				if (payBuildRecipe(nomad, this.placingWhat)) {
					this.sendAction('place', { ...worldCoords, what: this.placingWhat });
				} else {
					this.playSound('dud');
				}
				this.placingWhat = null;
				this.isMouseDown = false;
				return;
			}

			this.isDrilling = (this.getToolOverheat() < 1 && !nomad.ridingShipKey);
			if (!this.isDrilling) {
				this.playSound('dud');
			} else {
				this.sendAction('drill', worldCoords);
				// eslint-disable-next-line
				this.playSound([.3,.45,130.8128,.16,,.002,4,1.9,-17,-36.7,28,.04,.01,.6,,1,,.9,.01,.27]);
			}
		}
	}

	setupKeys() {
		const fkey = (e) => ((e.key.length === 1) ? e.key.toLowerCase() : e.key);
		window.onkeydown = (e) => {
			// treat all single keys as lowercase
			const key = fkey(e);
			if (key.substring(0, 1) === 'F') return; // Allow F12
			e.preventDefault();
			const { nomad } = this.world;
			if (key === 'p') this.toggleMoveMode();
			if (key === 'ArrowUp' || key === 'w') {
				if (!nomad.flying && nomad.ridingShipKey) {
					this.sendAction('launch');
					return;
				}
				this.moveNomad('up');
			} else if (key === 'ArrowDown' || key === 's') this.moveNomad('down');
			else if (key === 'ArrowLeft' || key === 'a') this.moveNomad('left');
			else if (key === 'ArrowRight' || key === 'd') this.moveNomad('right');
			else if (key === ' ') {
				this.localGameWorldSim.addAction(['jump', this.nomad.id]);
				this.playSound('jets'); // eslint-disable-line
			} else if (key === 'z') {
				this.interface.open = (this.interface.open === BUILD_INTERFACE) ? null : BUILD_INTERFACE;
			} else if (key === 'e') {
				if (!this.interface.open && !e.repeat) {
					let action = 'mount';
					if (nomad.flying) action = 'land';
					else if (nomad.ridingShipKey) action = 'dismount';
					this.playSound('zup');
					this.sendAction(action, { x: nomad.x, y: nomad.y });
				}
			} else if (key === 'Tab' || key === 'i') {
				this.interface.open = (this.interface.open === INV_INTERFACE) ? null : INV_INTERFACE;
				this.interface.nomad = this.world.nomad;
			} else if (key === 'Escape') {
				// LATER: Make this an options/discoveries/expedition menu
				this.introIndex = 0;
				this.interface.open = null;
			} else console.log(key);
		};
		window.onpointermove = (e) => {
			// if (this.interface) return;
			this.aimingVector = this.getScreenVector(e);
			const angle = Math.atan2(this.aimingVector.x, this.aimingVector.y);
			this.turnNomad(angle);
		};
		window.onpointerdown = (e) => { // click
			this.isMouseDown = true;
		};
		window.onpointerup = (e) => {
			this.isMouseDown = false;
		};
		window.setInterval(() => this.checkInputs(), 100);
	}

	handleVueEvent(e) {
		if (!e.detail) {
			console.warn('Vue event without detail');
			return;
		}
		switch (e.detail?.action) {
			case 'goBack': {
				this.interface.open = null;
				return;
			}
			case 'selectDeployable': {
				// TODO: If cannot afford recipe then do nothing and return
				this.interface.open = null;
				this.placingWhat = e.detail.deployable;
				return;
			}
			default: console.log('Unhandled action', e.detail.action);
		}
		console.log('Unhandled event from Vue', e);
	}

	async init() {
		const readyPromise = new Promise((resolve) => {
			window.addEventListener('DOMContentLoaded', resolve);
		});
		await readyPromise;
		await this.renderer.init();
		this.renderer.startDraw();
		this.setupKeys();

		// Set up the Vue UI and listen for events from it
		const eventType = 'vue-ui-event';
		window.addEventListener(eventType, (e) => this.handleVueEvent(e));
		const ui = createApp(UserInterface, { eventType, state: this.interface });
		ui.mount('#ui');
	}

	async startLocalGameWorldSim() {
		this.localGameWorldSim = await GameWorldSim.make('abc');
		// TODO: Do some "connection" to the game world sim
		this.localGameWorldSim.join(this.nomad.id, { ...this.nomad });
		this.localGameWorldSim.hooks.world = (...args) => this.updateWorld(...args);
		this.localGameWorldSim.start();
	}

	getToolOverheat() {
		return this.world.nomad.tools[this.world.nomad.equippedToolKey].overheat || 0;
	}

	updateChunks(chunkOn, extraChunks, chunks = []) {
		chunks.forEach((chunk) => {
			this.renderer.loadChunkTerrainImage(chunk);
		});
		// TODO LATER: Unload chunks that are far away so there's a chance to reload them later
		// to save on memory in `chunkTerrainImages`
		this.lastChunkOn.x = chunkOn.x;
		this.lastChunkOn.y = chunkOn.y;
	}

	updateWorld(worldData) {
		this.world = { ...worldData };
		if (this.world.chunkOn.x !== this.lastChunkOn.x
			|| this.world.chunkOn.y !== this.lastChunkOn.y
		) this.updateChunks(this.world.chunkOn, this.world.extraChunks, this.world.chunks);
	}

	static calcNoiseHeight(x, y, noiseScale, altitudeScale = 1, minHeight = 0, maxHeight = 1) {
		// const altitudeScale = maxHeight - minHeight;
		return clamp(
			altitudeScale * noise.simplex2(noiseScale * x, noiseScale * y),
			minHeight,
			maxHeight,
		);
	}

	static getPlanetHeight(planetX, planetY) {
		return GameClient.calcNoiseHeight(planetX, planetY, 0.015, 5, -3, 3);
	}
}
