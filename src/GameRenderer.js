import GameClientScreen from './GameClientScreen.js';
import ImageLoader from './ImageLoader.js';
import SpriteStack from './SpriteStack.js';
import PseudoRandomizer from './libs/PseudoRandomizer.js';
import Screen from './Screen.js';
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

const GROUND_COLOR = '#372d30';
const WATER_LINE = -2.9;
const WATER_COLORS = ['#1f2c37', '#325160', '#4189a0'];
const SPARK_COLORS = ['#f1d56c', '#dd7261', '#f80'];
const CRYSTAL_COLORS = {
	C: ['#9a3846', '#582432', '#bb4f4e', '#dd7261'],
	H: ['#4189a0', '#73c0c9', '#5580c5', '#4a5bb1', '#325160'],
	Na: ['#f1d56c', '#d5b14f', '#b38c31'],
	Fe: ['#555855'],
};
const GROUND_HEIGHT_COLORS = [
	// Go from height 1 onward
	[55, 45, 48],
	[85, 59, 63],
	[118, 79, 79],
	[153, 106, 97],
	[204, 172, 158],
];
// const introBackgrounds = ['title-64x64.png', 'intro-1.png', 'intro-2.png'];
// const TIP_HEIGHT = 10;

const { floor, PI } = Math;

export default class GameRenderer {
	constructor(dependencies = {}) {
		const {
			getClientRenderData,
			GameClient,
			Planet,
		} = dependencies;
		this.getClientRenderData = getClientRenderData;
		this.GameClient = GameClient;
		this.Planet = Planet;

		// Internal values
		this.drawId = null;
		this.isRunning = false;
		this.screen = null;
		this.camera = new Vector2(0, 0);
		this.sceneryScreen = new Screen(ITEM_PIXEL_SIZE * 10, ITEM_PIXEL_SIZE * 2, 'scenery');
		this.assembledNomadScreen = new Screen(NOMAD_PIXEL_SIZE, NOMAD_PIXEL_SIZE, 'nomad');
		this.chunkTerrainScreen = new Screen(CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, 'chunk', { willReadFrequently: true });
		this.chunkTerrainImages = { // Cache the terrain images for each chunk
			// Keys of "x_y" with the value of the image, e.g., "10_-90": (image data)
		};
		this.spriteStackConfig = {
			ref1: ['refiner-1.png', SHIP_PIXEL_SIZE, 6],
			ref2: ['refiner-1.png', SHIP_PIXEL_SIZE, 6],
			ref3: ['refiner-1.png', SHIP_PIXEL_SIZE, 6],
			rasa1: ['ship-1.png', SHIP_PIXEL_SIZE, 6],
		};
		this.spriteStacks = {
			ref1: null,
			ref2: null,
			ref3: null,
			rasa1: null,
			nomad1: null,
		};
	}

	static getNewColor(data, i, iOffset, h, hIndex) {
		const color = GROUND_HEIGHT_COLORS[hIndex];
		return ((data[i + iOffset] + h * 10) + color[iOffset]) / 2;
	}

	static getChunkTerrainKey(chunk) {
		return `${chunk.x}_${chunk.y}`;
	}

	async setupNomadSpriteStack() {
		const nomadSpriteSheet = await ImageLoader.loadImage('guy8-100x10.png');
		this.spriteStacks.nomad1 = new SpriteStack(nomadSpriteSheet, 10, 8);
		const c = this.spriteStacks.nomad1.stack(0).correctColors().getCanvas();
		this.spriteStacks.nomad1.cacheAllRotationImages();
		c.classList.add('guy');
		document.getElementById('debug').appendChild(c);
	}

	async loadSpriteStacks() {
		const keys = Object.keys(this.spriteStackConfig);
		const imageFiles = keys.map(
			(entityTypeKey) => this.spriteStackConfig[entityTypeKey][0],
		);
		const sheets = await ImageLoader.loadImages(imageFiles);
		keys.forEach((entityTypeKey, i) => {
			const [, pixelSize, stackCount = 6, rot = 0] = this.spriteStackConfig[entityTypeKey];
			const ss = new SpriteStack(sheets[i], pixelSize, stackCount);
			ss.rotationOffset = PI + rot;
			ss.cacheAllRotationImages();
			this.spriteStacks[entityTypeKey] = ss;
		});
		return this.spriteStacks;
	}

	async loadGameImages() {
		// this.introBackgroundImages = await ImageLoader.loadImages(
		// ['title-64x64.png', 'intro-1.png', 'intro-2.png']);
		// this.tipImages = await ImageLoader.loadImages([
		// 	'Z-Build-64x10.png',
		// 	'Click-Drill-64x10.png', 'Tab-Inventory-64x10.png', 'W-Walk-64x10.png',
		// ]);
		// this.campFireImage = await ImageLoader.loadImage('camp-fire.png');

		// const shipStackSpriteSheet = await ImageLoader.loadImage('ship-1.png');
		// this.spriteStacks.rasa1 = new SpriteStack(shipStackSpriteSheet, SHIP_PIXEL_SIZE, 6);
		// this.spriteStacks.rasa1.rotationOffset = PI;
		// this.spriteStacks.rasa1.cacheAllRotationImages();
		await this.loadSpriteStacks();
	}

	loadChunkTerrainImage(chunk) {
		const key = GameRenderer.getChunkTerrainKey(chunk);
		if (this.chunkTerrainImages[key]) return;
		console.log('drawing terrain', key, chunk.seed);
		this.chunkTerrainScreen.clear();
		// const half = Math.floor(CHUNK_PIXEL_SIZE / 2);
		// const baseColor = `#${String(Math.abs(chunk.seed)).substring(0, 4)}`;
		const r = new PseudoRandomizer(chunk.seed);
		const baseColor = `rgba(${r.random(255)},${r.random(255)},${r.random(255)},0.2)`;
		this.chunkTerrainScreen.fillRect(0, 0, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE, GROUND_COLOR);
		// Get Noise (perlin/simplex) and draw it pixel by pixel
		const chunkPlanetCoords = this.Planet.convertChunkCoordinatesToPlanetCoords(chunk);
		this.chunkTerrainScreen.loopPixelData(({ x, y, data, i }) => {
			const planetCoordsX = chunkPlanetCoords.x + x;
			const planetCoordsY = chunkPlanetCoords.y + y;
			const h = this.GameClient.getPlanetHeight(planetCoordsX, planetCoordsY);
			const hIndex = floor(h);
			// if (planetCoordsX % 2 === planetCoordsY % 2) return; // Dithering?
			/* eslint-disable prefer-destructuring, no-param-reassign */
			if (h > 0) {
				// const color = GROUND_HEIGHT_COLORS[hIndex];
				// data[i] = color[0];
				// data[i + 1] = color[1];
				// data[i + 2] = color[2];
				data[i] = GameRenderer.getNewColor(data, i, 0, h, hIndex);
				data[i + 1] = GameRenderer.getNewColor(data, i, 1, h, hIndex);
				data[i + 2] = GameRenderer.getNewColor(data, i, 2, h, hIndex);
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

	drawSpriteStackItem(item) {
		const { x, y, z = 0, key, rotation } = item;
		const image = this.spriteStacks[key].getRotatedImage(rotation);
		this.drawThing(image, { x, y, z }, SHIP_HALF_SIZE);
	}

	drawChunkItems(chunk, offset) {
		const { items = [], seed } = chunk;
		const chunkItemRandomizer = new PseudoRandomizer(seed);
		items.forEach((item) => {
			if (item.hp <= 0 || item.remove) return;
			const x = item.chunkOffsetX + offset.x;
			const y = item.chunkOffsetY + offset.y;
			if (this.spriteStacks[item.key]) {
				this.drawSpriteStackItem(item);
				return;
			}
			this.drawCrystal(item, x, y, chunkItemRandomizer);
		});
	}

	drawTerrain(world) {
		const { chunkOn, chunks = [] } = world;
		const getOffset = (chunk) => ({
			// x: CHUNK_PIXEL_SIZE * (chunk.x - chunkOn.x),
			// y: CHUNK_PIXEL_SIZE * (chunk.y - chunkOn.y),
			x: CHUNK_PIXEL_SIZE * chunk.x - this.camera.x,
			y: CHUNK_PIXEL_SIZE * chunk.y - this.camera.y,
		});
		chunks.forEach((chunk) => {
			const key = GameRenderer.getChunkTerrainKey(chunk);
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

	drawNomad(nomad, aimingVector, isDrilling) {
		const { x, y, z, rotation } = nomad;
		const aim = aimingVector;

		this.screen.drawCenterRect(0, 3 + z, 5.5, 2.5, '#0004'); // shadow

		this.screen.drawCenterLine(aim.x + 1, aim.y, aim.x + 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x - 1, aim.y, aim.x - 1, aim.y, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y - 1, aim.x, aim.y - 1, '#fff2');
		this.screen.drawCenterLine(aim.x, aim.y + 1, aim.x, aim.y + 1, '#fff2');

		if (isDrilling) {
			// Red-yellow colors: ['#f009', '#f529', '#fc49']
			this.drawFadedLine({ x: 0, y: 0 }, aim, ['#28f', '#8af', '#def', '#fff']);
			// Sparks
			this.screen.drawCenterLine(aim.x, aim.y, aim.x - 2 + randInt(5), aim.y - 2 + randInt(5), '#0009');
			const h = this.GameClient.getPlanetHeight(x + aim.x, y + aim.y);
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
		const stack = (nomad.ridingShipKey) ? this.spriteStacks.rasa1 : this.spriteStacks.nomad1;
		const image = stack.getRotatedImage(rotation);
		// Add a little bop +1 pixel if on foot
		const step = (nomad.flying) ? 0 : Math.round(x / 8 + y / 8) % 2;
		// TODO: fix magic numbers
		this.drawThing(image, { x: x - 3, y: y - 5 + step, z }, NOMAD_HALF_SIZE);
	}

	getTotalCarbon() {
		const totalC = this.getNomad().inventory.filter((invItem) => invItem.element === 'C')
			.reduce((sum, invItem) => (sum + invItem.quantity), 0);
		return totalC;
	}

	drawInterface(toolOverheat) {
		const { width, height } = this.screen;
		const barW = 20;
		this.screen.drawRect(width - barW - 1, height - 2, barW, 1, '#21202088');
		// const totalC = this.getTotalCarbon();
		// const min = (totalC === 0) ? 0 : 1;
		// const carbonW = clamp(Math.floor((totalC / FIRE_CARBON_COST) * barW), min, barW);
		// this.screen.drawRect(width - carbonW - 1, height - 2, carbonW, 1, '#9a3846');
		// if (totalC >= FIRE_CARBON_COST) {
		// 	this.screen.drawImage(this.tipImages[0], 0, this.screen.height - TIP_HEIGHT);
		// }
		const oh = toolOverheat;
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
	}

	draw() {
		const {
			nomad,
			world,
			aimingVector,
			isInterfaceOpen,
			toolOverheat,
			isDrilling,
		} = this.getClientRenderData();
		// this.camera.x = this.world.nomad.x;
		// this.camera.y = this.world.nomad.y;
		const target = new Vector2(nomad.x, nomad.y - nomad.z);
		this.camera = this.camera.lerp(target, 0.5).floor();
		this.screen.clear();
		this.drawTerrain(world);
		this.drawNomad(nomad, aimingVector, isDrilling);
		if (!isInterfaceOpen) this.drawInterface(toolOverheat);
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

	async init() {
		await this.loadGameImages();
		this.screen = await GameClientScreen.make('c');
		this.chunkTerrainScreen.init();
		this.sceneryScreen.init();
		this.assembledNomadScreen.init();
		await this.setupNomadSpriteStack();
	}
}
