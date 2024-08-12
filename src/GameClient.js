// import { PseudoRandomizer } from 'rocket-utility-belt';
import PseudoRandomizer from './libs/PseudoRandomizer.js';
import GameClientScreen from './GameClientScreen.js';
import Screen from './Screen.js';
import GameWorldSim from './GameWorldSim.js';
import SpriteStack from './SpriteStack.js';
import { uid, getXYCoordinatesFromPolar } from './utils.js';
import {
	CHUNK_PIXEL_SIZE, NOMAD_PIXEL_SIZE, NOMAD_HALF_SIZE,
	ITEM_PIXEL_SIZE,
} from './constants.js';

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
		this.moveMode = MOVE_MODE_FACING;
		this.nomadSpriteStack = null;
	}

	static getChunkTerrainKey(chunk) {
		return `${chunk.x}_${chunk.y}`;
	}

	static async loadImage(src) {
		const img = new Image();
		const loadPromise = new Promise((resolve) => { img.onload = resolve; });
		img.src = src;
		await loadPromise;
		return img;
	}

	moveNomad(arrow) {
		if (this.moveMode === MOVE_MODE_CARDINAL) {
			this.localGameWorldSim.addAction(['move', this.nomad.id, { ...CARDINAL[arrow] }]);
			return;
		}
		this.localGameWorldSim.addAction([FACING_ACTIONS[arrow], this.nomad.id]);
	}

	turnNomad(angle) {
		if (angle === this.world.nomad.angle) return;
		this.localGameWorldSim.addAction(['turn', this.nomad.id, { angle }]);
	}

	toggleMoveMode() {
		this.moveMode = (this.moveMode === MOVE_MODE_FACING) ? MOVE_MODE_CARDINAL : MOVE_MODE_FACING;
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
			else console.log(key);
			// this.keyDown[key] = KEY_DOWN;
			// this.pushButton(this.keyMap[key]);
			// if (this.keyMap[key] === undefined) console.log('Unmapped key:', key);
			// this.moveNomad(0, 1);
			e.preventDefault();
			// if (!e.repeat) console.log(this.buttonDown, this.keyDown);
		};
		window.onmousemove = (e) => {
			const screenCenter = this.screen.getPageCenter();
			const vector = { x: e.x - screenCenter.x, y: e.y - screenCenter.y };
			const angle = Math.atan2(vector.x, vector.y);
			this.turnNomad(angle);
			// console.log(e.x, e.y, screenCenter.x, screenCenter.y, vector.x, vector.y, angle);
		};
	}

	async setupNomadSpriteStack() {
		const nomadSpriteSheet = await GameClient.loadImage('./images/guy-6pixel-100x10.png');
		this.nomadSpriteStack = new SpriteStack(nomadSpriteSheet, 10, 7);
		const c = this.nomadSpriteStack.stack(0).getCanvas();
		c.classList.add('guy');
		document.getElementById('debug').appendChild(c);
	}

	async init() {
		const readyPromise = new Promise((resolve) => {
			window.addEventListener('DOMContentLoaded', resolve);
		});
		await readyPromise;
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
		const baseColor = `#${String(Math.abs(chunk.seed)).substring(0, 4)}`;
		const r = new PseudoRandomizer(chunk.seed);
		this.chunkTerrainScreen.fillRect(0, 0, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, '#323638');
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
		});
	}

	drawThing(image, { x, y, z }, halfSize) {
		const screenX = x - this.camera.x - halfSize;
		const screenY = (y - this.camera.y - halfSize) - Math.round(z);
		this.screen.drawCenterImage(image, screenX, screenY);
	}

	drawNomad() {
		this.assembledNomadScreen.fillRect(0, 0, NOMAD_PIXEL_SIZE, NOMAD_PIXEL_SIZE, '#000');
		const bg = this.assembledNomadScreen.getImage();
		this.drawThing(bg, this.world.nomad, NOMAD_HALF_SIZE);
		const { rotation } = this.world.nomad;
		const image = this.nomadSpriteStack.stack(rotation).getImage();
		this.drawThing(image, this.world.nomad, NOMAD_HALF_SIZE);

		const lineStart = getXYCoordinatesFromPolar(rotation, 10);
		const lineEnd = getXYCoordinatesFromPolar(rotation, 14);
		this.screen.drawCenterLine(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y, '#fff4');
	}

	draw() {
		this.camera.x = this.world.nomad.x;
		this.camera.y = this.world.nomad.y;
		this.screen.clear();
		this.drawTerrain();
		this.drawNomad();
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
