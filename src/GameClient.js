// import { PseudoRandomizer } from 'rocket-utility-belt';
import PseudoRandomizer from './libs/PseudoRandomizer.js';
import GameClientScreen from './GameClientScreen.js';
import ImageLoader from './ImageLoader.js';
import Screen from './Screen.js';
import GameWorldSim from './GameWorldSim.js';
import SpriteStack from './SpriteStack.js';
import { uid, getXYCoordinatesFromPolar, Vector2, randInt, clamp } from './utils.js';
import {
	CHUNK_PIXEL_SIZE,
	NOMAD_PIXEL_SIZE, NOMAD_HALF_SIZE,
	SHIP_PIXEL_SIZE, SHIP_HALF_SIZE,
	ITEM_PIXEL_SIZE,
	INV_ITEMS,
} from './constants.js';

const { floor, PI } = Math;

const FIRE_CARBON_COST = 128;
const GROUND_COLOR = '#343435'; // '#323638'; // '#1f2c37'; // '#323638';
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
		this.camera = { x: 0, y: 0 };
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
		this.interface = INTRO_INTERFACE;
		this.introIndex = 0;
		this.introBackgroundImages = [];
		this.tipImages = [];
		this.campFireImage = null;
	}

	static getChunkTerrainKey(chunk) {
		return `${chunk.x}_${chunk.y}`;
	}

	sendAction(actionName, details) {
		this.localGameWorldSim.addAction(
			[actionName, this.nomad.id, { ...details, tick: this.world.tick }],
		);
	}

	moveNomad(arrow) {
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
		if (this.isMouseDown) {
			const worldCoords = this.convertCenterCoordinatesToWorldCoordinates(this.aimingVector);
			this.sendAction('drill', worldCoords);
		}
	}

	setupKeys() {
		const fkey = (e) => ((e.key.length === 1) ? e.key.toLowerCase() : e.key);
		window.onkeydown = (e) => {
			// treat all single keys as lowercase
			const key = fkey(e);
			if (key === 'p') this.toggleMoveMode();
			if (key === 'ArrowUp' || key === 'w') this.moveNomad('up');
			else if (key === 'ArrowDown' || key === 's') this.moveNomad('down');
			else if (key === 'ArrowLeft' || key === 'a') this.moveNomad('left');
			else if (key === 'ArrowRight' || key === 'd') this.moveNomad('right');
			else if (key === ' ') this.localGameWorldSim.addAction(['jump', this.nomad.id]);
			else if (key === 'z') {
				if (this.getTotalCarbon() >= FIRE_CARBON_COST) {
					this.interface = WIN_INTERFACE;
				}
			} else if (key === 'Tab') {
				this.interface = (this.interface === INV_INTERFACE) ? null : INV_INTERFACE;
			} else if (key === 'Escape') {
				// LATER: Make this an options/discoveries/expedition menu
				this.introIndex = 0;
				this.interface = INTRO_INTERFACE;
			} else console.log(key);
			// this.keyDown[key] = KEY_DOWN;
			// this.pushButton(this.keyMap[key]);
			// if (this.keyMap[key] === undefined) console.log('Unmapped key:', key);
			// this.moveNomad(0, 1);
			e.preventDefault();
			// if (!e.repeat) console.log(this.buttonDown, this.keyDown);
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
				if (this.introIndex >= introBackgrounds.length) {
					this.interface = null;
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

	loadChunkTerrainImage(chunk) {
		const key = GameClient.getChunkTerrainKey(chunk);
		if (this.chunkTerrainImages[key]) return;
		console.log('drawing terrain', key, chunk.seed);
		this.chunkTerrainScreen.clear();
		const half = Math.floor(CHUNK_PIXEL_SIZE / 2);
		// const baseColor = `#${String(Math.abs(chunk.seed)).substring(0, 4)}`;
		const r = new PseudoRandomizer(chunk.seed);
		const baseColor = `rgba(${r.random(255)},${r.random(255)},${r.random(255)},0.2)`;
		this.chunkTerrainScreen.fillRect(0, 0, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, GROUND_COLOR);
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
			if (item.hp <= 0) return;
			const x = item.x + offset.x;
			const y = item.y + offset.y;
			if (item.isShip) {
				const image = this.shipSpriteStack.getRotatedImage(-0.9);
				this.screen.drawCenterImage(image, x, y);
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

	drawNomad() {
		const { x, y, z, rotation } = this.world.nomad;
		const aim = this.aimingVector;

		this.screen.drawCenterRect(0, 3, 5.5, 2.5, '#0004');

		this.screen.drawCenterLine(aim.x + 1, aim.y, aim.x + 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x - 1, aim.y, aim.x - 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y - 1, aim.x, aim.y - 1, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y + 1, aim.x, aim.y + 1, '#fff2');

		if (this.isMouseDown) {
			// Red-yellow colors: ['#f009', '#f529', '#fc49']
			this.drawFadedLine({ x: 0, y: 0 }, aim, ['#28f', '#8af', '#def', '#fff']);
			// Sparks
			this.screen.drawCenterLine(aim.x, aim.y, aim.x - 2 + randInt(5), aim.y - 2 + randInt(5), '#0009');
			this.screen.drawCenterLine(aim.x, aim.y, aim.x - 2 + randInt(5), aim.y - 2 + randInt(5), '#f84');
		} else {
			const lineStart = getXYCoordinatesFromPolar(rotation, 12);
			const lineEnd = getXYCoordinatesFromPolar(rotation, 16);
			this.screen.drawCenterLine(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y, '#fff1');
		}

		// this.assembledNomadScreen.fillRect(0, 0, NOMAD_PIXEL_SIZE, NOMAD_PIXEL_SIZE, '#000');w
		// const bg = this.assembledNomadScreen.getImage();
		// this.drawThing(bg, { x, y, z }, NOMAD_HALF_SIZE);
		const stack = (false) ? this.shipSpriteStack : this.nomadSpriteStack;
		const image = stack.getRotatedImage(rotation);
		const step = Math.round(x / 8 + y / 8) % 2; // Add a little bop +1 pixel
		this.drawThing(image, { x: x - 3, y: y - 5 + step, z }, NOMAD_HALF_SIZE); // TODO: fix magic numbers
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
		this.camera.x = this.world.nomad.x;
		this.camera.y = this.world.nomad.y;
		this.screen.clear();
		this.drawTerrain();
		this.drawNomad();
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
