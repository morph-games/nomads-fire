// import { PseudoRandomizer } from 'rocket-utility-belt';
import zzfx from './libs/ZzFXMicro.min.esm.js';
import PseudoRandomizer from './libs/PseudoRandomizer.js';
import GameClientScreen from './GameClientScreen.js';
import ImageLoader from './ImageLoader.js';
import Screen from './Screen.js';
import GameWorldSim from './GameWorldSim.js';
import Planet from './Planet.js';
import SpriteStack from './SpriteStack.js';
import noise from './libs/noise.js';
import {
	uid, getXYCoordinatesFromPolar, Vector2, randInt, clamp, pick,
	loopPixelData,
} from './utils.js';
import {
	CHUNK_PIXEL_SIZE,
	NOMAD_PIXEL_SIZE, NOMAD_HALF_SIZE,
	SHIP_PIXEL_SIZE, SHIP_HALF_SIZE,
	ITEM_PIXEL_SIZE,
	INV_ITEMS,
} from './constants.js';

const { floor, PI } = Math;

const FIRE_CARBON_COST = 128;
const GROUND_COLOR = '#372d30';
const GROUND_HEIGHT_COLORS = [
	// Go from height 1 onward
	[55, 45, 48],
	[85, 59, 63],
	[118, 79, 79],
	[153, 106, 97],
	[204, 172, 158],
];
const WATER_LINE = -2.9;
const WATER_COLORS = ['#1f2c37', '#325160', '#4189a0'];
const SPARK_COLORS = ['#f1d56c', '#dd7261', '#f80'];
const CRYSTAL_COLORS = {
	C: ['#9a3846', '#582432', '#bb4f4e', '#dd7261'],
	H: ['#4189a0', '#73c0c9', '#5580c5', '#4a5bb1', '#325160'],
	Na: ['#f1d56c', '#d5b14f', '#b38c31'],
};
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
const INTERFACES = {
	intro: {},
	inv: {},
	options: {},
	win: {},
};
const INV_INTERFACE = 'inv';
const INTRO_INTERFACE = 'intro';
const WIN_INTERFACE = 'win';
const introBackgrounds = ['title-64x64.png', 'intro-1.png', 'intro-2.png'];
const TIP_HEIGHT = 10;
const todaysSeed = PseudoRandomizer.getPseudoRandInt(Number(new Date()), 1000);

export default class GameClient {
	constructor() {
		this.nomad = {
			id: uid(),
			name: 'Norman',
		};
		this.localGameWorldSim = null;
		this.isRunning = true;
		this.drawId = null;
		this.ctx = null;
		this.world = null;
		this.screen = null;
		this.camera = new Vector2(0, 0);
		this.lastChunkOn = { x: null, y: null };
		this.chunkTerrainScreen = new Screen(CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, 'chunk');
		this.sceneryScreen = new Screen(ITEM_PIXEL_SIZE * 10, ITEM_PIXEL_SIZE * 2, 'scenery');
		this.assembledNomadScreen = new Screen(NOMAD_PIXEL_SIZE, NOMAD_PIXEL_SIZE, 'nomad');
		this.chunkTerrainImages = { // Cache the terrain images for each chunk
			// Keys of "x_y" with the value of the image, e.g., "10_-90": (image data)
		};
		this.aimingVector = new Vector2(0, 0);
		this.moveMode = MOVE_MODE_FACING;
		this.nomadSpriteStack = null;
		this.shipSpriteStack = null;
		this.isMouseDown = false;
		this.isDrilling = false;
		this.interface = INTRO_INTERFACE;
		this.introIndex = 0;
		this.introBackgroundImages = [];
		this.tipImages = [];
		this.campFireImage = null;
		this.soundOn = true;
		this.moveCounter = 0;

		noise.seed(todaysSeed); // TODO: Move this to Planet
	}

	static getChunkTerrainKey(chunk) {
		return `${chunk.x}_${chunk.y}`;
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
		const screenCenter = this.screen.getPageCenter();
		return new Vector2(
			floor((x - screenCenter.x) / this.screen.sizeMultiplier),
			floor((y - screenCenter.y) / this.screen.sizeMultiplier),
		);
	}

	convertCenterCoordinatesToWorldCoordinates({ x, y }) {
		return new Vector2(x + this.camera.x, y + this.camera.y);
	}

	checkInputs() {
		this.isDrilling = false;
		if (this.isMouseDown && !this.interface) {
			const { nomad } = this.world;
			const worldCoords = this.convertCenterCoordinatesToWorldCoordinates(this.aimingVector);
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
			e.preventDefault();
			// treat all single keys as lowercase
			const key = fkey(e);
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
				if (this.getTotalCarbon() >= FIRE_CARBON_COST) {
					this.interface = WIN_INTERFACE;
				}
			} else if (key === 'e') {
				if (!this.interface && !e.repeat) {
					let action = 'mount';
					if (nomad.flying) action = 'land';
					else if (nomad.ridingShipKey) action = 'dismount';
					this.playSound('zup');
					this.sendAction(action, { x: nomad.x, y: nomad.y });
				}
			} else if (key === 'Tab') {
				this.interface = (this.interface === INV_INTERFACE) ? null : INV_INTERFACE;
			} else if (key === 'Escape') {
				// LATER: Make this an options/discoveries/expedition menu
				this.introIndex = 0;
				this.interface = INTRO_INTERFACE;
			} else console.log(key);
		};
		window.onmousemove = (e) => {
			if (this.interface) return;
			this.aimingVector = this.getScreenVector(e);
			const angle = Math.atan2(this.aimingVector.x, this.aimingVector.y);
			this.turnNomad(angle);
		};
		window.onmousedown = (e) => {
			this.isMouseDown = true;
		};
		window.onmouseup = (e) => {
			this.isMouseDown = false;
		};
		window.onclick = (e) => {
			if (this.interface === INTRO_INTERFACE) {
				this.introIndex += 1;
				this.playSound('zip');
				if (this.introIndex >= introBackgrounds.length) {
					this.interface = null;
					this.playSound('gameGo');
				}
			} else if (this.interface === WIN_INTERFACE) {
				this.interface = null;
			}
		};
		window.setInterval(() => this.checkInputs(), 100);
	}

	async setupNomadSpriteStack() {
		const nomadSpriteSheet = await ImageLoader.loadImage('guy8-100x10.png');
		this.nomadSpriteStack = new SpriteStack(nomadSpriteSheet, 10, 8);
		const c = this.nomadSpriteStack.stack(0).correctColors().getCanvas();
		this.nomadSpriteStack.cacheAllRotationImages();
		c.classList.add('guy');
		document.getElementById('debug').appendChild(c);
	}

	async loadGameImages() {
		this.introBackgroundImages = await ImageLoader.loadImages(introBackgrounds);
		this.tipImages = await ImageLoader.loadImages([
			'Z-Build-64x10.png',
			'Click-Drill-64x10.png', 'Tab-Inventory-64x10.png', 'W-Walk-64x10.png',
		]);
		this.campFireImage = await ImageLoader.loadImage('camp-fire.png');
		const shipStackSpriteSheet = await ImageLoader.loadImage('ship-1.png');
		this.shipSpriteStack = new SpriteStack(shipStackSpriteSheet, SHIP_PIXEL_SIZE, 6);
		this.shipSpriteStack.rotationOffset = PI;
		this.shipSpriteStack.cacheAllRotationImages();
	}

	async init() {
		const readyPromise = new Promise((resolve) => {
			window.addEventListener('DOMContentLoaded', resolve);
		});
		await readyPromise;
		await this.loadGameImages();
		this.screen = await GameClientScreen.make('c');
		this.chunkTerrainScreen.init();
		this.sceneryScreen.init();
		this.assembledNomadScreen.init();
		await this.setupNomadSpriteStack();
		this.startDraw();
		this.setupKeys();
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
			this.loadChunkTerrainImage(chunk);
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

	static getNewColor(data, i, iOffset, h, hIndex) {
		const color = GROUND_HEIGHT_COLORS[hIndex];
		return ((data[i + iOffset] + h * 10) + color[iOffset]) / 2;
	}

	loadChunkTerrainImage(chunk) {
		const key = GameClient.getChunkTerrainKey(chunk);
		if (this.chunkTerrainImages[key]) return;
		console.log('drawing terrain', key, chunk.seed);
		this.chunkTerrainScreen.clear();
		// const half = Math.floor(CHUNK_PIXEL_SIZE / 2);
		// const baseColor = `#${String(Math.abs(chunk.seed)).substring(0, 4)}`;
		const r = new PseudoRandomizer(chunk.seed);
		const baseColor = `rgba(${r.random(255)},${r.random(255)},${r.random(255)},0.2)`;
		this.chunkTerrainScreen.fillRect(0, 0, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, GROUND_COLOR);
		// Get Noise (perlin/simplex) and draw it pixel by pixel
		const chunkPlanetCoords = Planet.convertChunkCoordinatesToPlanetCoords(chunk);
		this.chunkTerrainScreen.loopPixelData(({ x, y, data, i }) => {
			const planetCoordsX = chunkPlanetCoords.x + x;
			const planetCoordsY = chunkPlanetCoords.y + y;
			const h = GameClient.getPlanetHeight(planetCoordsX, planetCoordsY);
			const hIndex = floor(h);
			// if (planetCoordsX % 2 === planetCoordsY % 2) return; // Dithering?
			/* eslint-disable prefer-destructuring, no-param-reassign */
			if (h > 0) {
				// const color = GROUND_HEIGHT_COLORS[hIndex];
				// data[i] = color[0];
				// data[i + 1] = color[1];
				// data[i + 2] = color[2];
				data[i] = GameClient.getNewColor(data, i, 0, h, hIndex);
				data[i + 1] = GameClient.getNewColor(data, i, 1, h, hIndex);
				data[i + 2] = GameClient.getNewColor(data, i, 2, h, hIndex);
			} else if (h < WATER_LINE) {
				// Water color: 1f2c37 = 31,44,55
				data[i] = 31; // 38
				data[i + 1] = 44; // 32;
				data[i + 2] = 55; // 67;
			}
			/* eslint-enable prefer-destructuring, no-param-reassign */
		});
		// Add random boxes
		for (let i = 0; i < 50; i += 1) {
			const x = r.random(CHUNK_PIXEL_SIZE);
			const y = r.random(CHUNK_PIXEL_SIZE);
			let sizeX = 1;
			let sizeY = 1;
			if (r.random(4) === 0) {
				sizeX = r.random(3) + 1;
				sizeY = r.random(3) + 1;
			}
			let color = baseColor;
			if (r.random(3) === 0) {
				color = `rgba(${r.random(255)},${r.random(255)},${r.random(255)},0.1)`;
			}
			this.chunkTerrainScreen.fillRect(x, y, sizeX, sizeY, color);
		}
		// this.chunkTerrainScreen.fillRect(0, 0, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, baseColor);
		// this.chunkTerrainScreen.fillRect(half + half/2, half, half/2, half, '#347');
		this.chunkTerrainImages[key] = this.chunkTerrainScreen.getImage();
	}

	drawCrystal(item, x, y, chunkItemRandomizer) {
		const color = chunkItemRandomizer.pick(CRYSTAL_COLORS[item.element]) || '#fff';
		// this.screen.drawCenterLine(offset.x,
		// offset.y, item.x + offset.x, item.y + offset.y, '#0003');

		if (item.size >= 5) {
			this.screen.drawCenterPixel(x, y - 2, color);
			this.screen.drawCenterLine(x - 1, y - 1, x + 1, y - 1, color);
			this.screen.drawCenterLine(x - 2, y, x + 2, y, color);
		} else if (item.size >= 3) {
			this.screen.drawCenterPixel(x, y - 1, color);
			this.screen.drawCenterLine(x - 1, y - 1, x + 1, y, color);
		} else {
			this.screen.drawCenterPixel(x, y, color);
		}
	}

	drawChunkItems(chunk, offset) {
		const { items = [], seed } = chunk;
		const chunkItemRandomizer = new PseudoRandomizer(seed);
		items.forEach((item) => {
			if (item.hp <= 0 || item.remove) return;
			const x = item.chunkOffsetX + offset.x;
			const y = item.chunkOffsetY + offset.y;
			if (item.ship) {
				const { x, y } = item;
				const image = this.shipSpriteStack.getRotatedImage(item.rotation);
				this.drawThing(image, { x, y, z: 0 }, SHIP_HALF_SIZE);
				// this.screen.drawCenterImage(image, x, y);
				return;
			}
			this.drawCrystal(item, x, y, chunkItemRandomizer);
		});
	}

	drawTerrain() {
		const { chunkOn, chunks = [] } = this.world;
		const getOffset = (chunk) => ({
			// x: CHUNK_PIXEL_SIZE * (chunk.x - chunkOn.x),
			// y: CHUNK_PIXEL_SIZE * (chunk.y - chunkOn.y),
			x: CHUNK_PIXEL_SIZE * chunk.x - this.camera.x,
			y: CHUNK_PIXEL_SIZE * chunk.y - this.camera.y,
		});
		chunks.forEach((chunk) => {
			const key = GameClient.getChunkTerrainKey(chunk);
			const offset = getOffset(chunk);
			this.screen.drawCenterImage(this.chunkTerrainImages[key], offset.x, offset.y);
			this.drawChunkItems(chunk, offset);
			// Debug grid
			// this.screen.drawCenterLine(offset.x, offset.y, offset.x + 64, offset.y, '#0003');
			// this.screen.drawCenterLine(offset.x, offset.y, offset.x, offset.y + 64, '#0003');
		});
	}

	drawThing(image, { x, y, z }, halfSize) {
		const screenX = x - this.camera.x - halfSize;
		const screenY = (y - this.camera.y - halfSize) - Math.round(z);
		this.screen.drawCenterImage(image, screenX, screenY);
	}

	drawFadedLine(start, end, colors = []) {
		const n = colors.length;
		let startX = start.x;
		let startY = start.y;
		const endXSegment = end.x / n;
		const endYSegment = end.y / n;
		for (let i = 0; i < n; i += 1) {
			const endX = endXSegment * (i + 1);
			const endY = endYSegment * (i + 1);
			this.screen.drawCenterLine(startX, startY, endX, endY, colors[i]);
			startX = endX;
			startY = endY;
		}
	}

	drawNomad(nomad) {
		const { x, y, z, rotation } = nomad;
		const aim = this.aimingVector;

		this.screen.drawCenterRect(0, 3 + z, 5.5, 2.5, '#0004'); // shadow

		this.screen.drawCenterLine(aim.x + 1, aim.y, aim.x + 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x - 1, aim.y, aim.x - 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y - 1, aim.x, aim.y - 1, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y + 1, aim.x, aim.y + 1, '#fff2');

		if (this.isDrilling) {
			// Red-yellow colors: ['#f009', '#f529', '#fc49']
			this.drawFadedLine({ x: 0, y: 0 }, aim, ['#28f', '#8af', '#def', '#fff']);
			// Sparks
			this.screen.drawCenterLine(aim.x, aim.y, aim.x - 2 + randInt(5), aim.y - 2 + randInt(5), '#0009');
			const h = GameClient.getPlanetHeight(x + aim.x, y + aim.y);
			const sparkColor = pick((h < WATER_LINE) ? WATER_COLORS : SPARK_COLORS);
			this.screen.drawCenterLine(
				aim.x,
				aim.y,
				aim.x - 3 + randInt(7),
				aim.y - 3 + randInt(7),
				sparkColor,
			);
		} else {
			const lineStart = getXYCoordinatesFromPolar(rotation, 12);
			const lineEnd = getXYCoordinatesFromPolar(rotation, 16);
			this.screen.drawCenterLine(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y, '#fff1');
		}

		// this.assembledNomadScreen.fillRect(0, 0, NOMAD_PIXEL_SIZE, NOMAD_PIXEL_SIZE, '#000');w
		// const bg = this.assembledNomadScreen.getImage();
		// this.drawThing(bg, { x, y, z }, NOMAD_HALF_SIZE);
		const stack = (nomad.ridingShipKey) ? this.shipSpriteStack : this.nomadSpriteStack;
		const image = stack.getRotatedImage(rotation);
		// Add a little bop +1 pixel if on foot
		const step = (nomad.flying) ? 0 : Math.round(x / 8 + y / 8) % 2;
		// TODO: fix magic numbers
		this.drawThing(image, { x: x - 3, y: y - 5 + step, z }, NOMAD_HALF_SIZE);
	}

	getTotalCarbon() {
		const totalC = this.world.nomad.inventory.filter((invItem) => invItem.element === 'C')
			.reduce((sum, invItem) => (sum + invItem.quantity), 0);
		return totalC;
	}

	drawInterface() {
		const { width, height } = this.screen;
		if (!this.interface) {
			const barW = 20;
			this.screen.drawRect(width - barW - 1, height - 2, barW, 1, '#21202088');
			const totalC = this.getTotalCarbon();
			const min = (totalC === 0) ? 0 : 1;
			const carbonW = clamp(Math.floor((totalC / FIRE_CARBON_COST) * barW), min, barW);
			this.screen.drawRect(width - carbonW - 1, height - 2, carbonW, 1, '#9a3846');
			if (totalC >= FIRE_CARBON_COST) {
				this.screen.drawImage(this.tipImages[0], 0, this.screen.height - TIP_HEIGHT);
			}
			const oh = this.getToolOverheat();
			const overheatW = clamp(Math.floor(oh * barW), 0, barW);
			this.screen.drawRect(width - barW - 1, 2, barW, 1, '#21202088');
			let heatColor = '#fff';
			if (oh < 0.2) heatColor = '#5580c5';
			else if (oh < 0.4) heatColor = '#73c0c9';
			else if (oh < 0.6) heatColor = '#f1d56c';
			else if (oh < 0.8) heatColor = '#dd7261';
			else if (oh < 0.9) heatColor = '#bb4f4e';
			else heatColor = '#9a3846';
			this.screen.drawRect(width - overheatW - 1, 2, overheatW, 1, heatColor);
		} else if (this.interface === INV_INTERFACE) {
			this.screen.drawRect(0, 0, 64, 64, '#1f2c37dd');
			this.screen.drawRect(1, 12, 62, 1, '#325160');
			this.screen.drawRect(1, 30, 62, 1, '#325160');
			// WIP - Technology rows
			for (let y = 0; y < 2; y += 1) {
				for (let x = 0; x < 6; x += 1) {
					this.screen.drawRect(x * 9 + 5, y * 8 + 14, 8, 7, '#21202088');
				}
			}
			// Inventory rows
			let i = 0;
			for (let y = 0; y < 4; y += 1) {
				for (let x = 0; x < 6; x += 1) {
					let color = '#21202088'; // '#34343588';
					let h = 7;
					const invItem = this.world.nomad.inventory[i];
					if (invItem) {
						color = invItem.color;
						h = Math.max(Math.floor((invItem.quantity / invItem.max) * 7), 1);
						this.screen.drawRect(x * 9 + 5, y * 8 + 32, 8, 7, '#474545');
					}
					this.screen.drawRect(x * 9 + 5, y * 8 + 32 + (7 - h), 8, h, color);
					i += 1;
				}
			}
		} else if (this.interface === INTRO_INTERFACE) {
			this.screen.drawImage(this.introBackgroundImages[this.introIndex], 0, 0);
		} else if (this.interface === WIN_INTERFACE) {
			this.screen.drawImage(this.campFireImage, 0, 0);
		}
	}

	draw() {
		const { nomad } = this.world;
		// this.camera.x = this.world.nomad.x;
		// this.camera.y = this.world.nomad.y;
		const target = new Vector2(nomad.x, nomad.y - nomad.z);
		this.camera = this.camera.lerp(target, 0.5).floor();
		this.screen.clear();
		this.drawTerrain();
		this.drawNomad(nomad);
		this.drawInterface();
		// TODO: render main screen
		// TODO: render debug canvases
		// TODO: correct colors
		this.nextDraw();
	}

	nextDraw() {
		if (!this.isRunning) return;
		this.drawId = window.requestAnimationFrame(
			(timeStamp) => {
				if (this.isRunning) this.draw(timeStamp);
			},
		);
	}

	startDraw() {
		this.isRunning = true;
		this.nextDraw();
	}

	stopDraw() {
		window.cancelAnimationFrame(this.drawId);
	}
}
