import {
	CHUNK_PIXEL_SIZE,
	PLANET_PIXEL_SIZE,
	INV_ITEMS,
	MAX_IVENTORY,
	MAX_TECHNOLOGY,
} from './constants.js';
import { vec2, getXYCoordinatesFromPolar, uid, calcVectorLength, randInt } from './utils.js';
import PseudoRandomizer from './libs/PseudoRandomizer.js';

const MAX_NOMAD_VEL = 18;
const MAX_ITEM_SIZE = 7;

const { round, abs } = Math;

export default class GameWorldSim {
	constructor(name, seed = 1000) {
		this.name = name;
		this.tick = 0;
		this.seed = seed;
		this.planet = {
			galaxy: 0,
			sectorX: 0,
			sectorY: 0,
			index: 0,
			seed,
		};
		this.actionQueue = [];
		this.nomads = {};
		this.nomadIds = [];
		this.started = false;
		this.hooks = {};
		this.actionQueue = [];
		this.chunkItems = {}; // a cache of items for chunks
	}

	static async make(name, seed = 1000) {
		const gws = new GameWorldSim(name, seed);
		await gws.init();
		return gws;
	}

	static wait(ms = 1) {
		return new Promise((resolve) => { setTimeout(resolve, ms); });
	}

	static getChunkCoordinatesAt(planetX, planetY) {
		const getChunkCoord = (n) => Math.floor(
			((n >= 0) ? n : (PLANET_PIXEL_SIZE + n)) / CHUNK_PIXEL_SIZE,
		);
		return { x: getChunkCoord(planetX), y: getChunkCoord(planetY) };
	}

	static convertChunkCoordinatesToWorld(chunkCoords) {
		return { x: chunkCoords.x * CHUNK_PIXEL_SIZE, y: chunkCoords.y * CHUNK_PIXEL_SIZE };
	}

	static addPlanetCoordinates(obj, addCoords) {
		GameWorldSim.setPlanetCoordinates(obj, { x: obj.x + addCoords.x, y: obj.y + addCoords.y });
	}

	static setPlanetCoordinates(objToMutate, newCoords) {
		const obj = objToMutate;
		obj.x = newCoords.x % PLANET_PIXEL_SIZE;
		obj.y = newCoords.y % PLANET_PIXEL_SIZE;
		if (obj.x < 0) obj.x = PLANET_PIXEL_SIZE + obj.x;
		if (obj.y < 0) obj.y = PLANET_PIXEL_SIZE + obj.y;
	}

	static makeChunkId(planet, chunkX, chunkY) {
		return [planet.galaxy, planet.sectorX, planet.sectorY, planet.index, chunkX, chunkY].join('_');
	}

	static makeChunkSeed(planet, chunkX, chunkY) {
		return planet.seed
			+ PseudoRandomizer.getPseudoRandInt(chunkX, 999)
			+ PseudoRandomizer.getPseudoRandInt(chunkY, 999);
	}

	join(nomadId, details = {}) {
		const { nomads, nomadIds } = this;
		if (nomads[nomadId]) return; // already there
		nomadIds.push(nomadId);
		const x = Math.round(PLANET_PIXEL_SIZE / 2);
		const y = Math.round(PLANET_PIXEL_SIZE / 2);
		nomads[nomadId] = {
			...details,
			galaxyIndex: 0,
			system: { sectorX: 0, sectorY: 0, systemIndex: 0 },
			planetIndex: 0,
			x,
			y,
			z: 0,
			vel: { x: 0, y: 0, z: 0 },
			rotation: 0, // 0 = down, PI = up, positive half pi = right, negative half pi = left
			inventory: [],
			technology: [], // WIP
			news: [], // WIP
		};

		// We want to add a ship to the chunk the player starts on, so we first have to get the
		// chunk's items and cache them.
		const { planet } = this; // TODO: get from nomad
		const chunkOn = GameWorldSim.getChunkCoordinatesAt(x, y);
		const chunkId = GameWorldSim.makeChunkId(planet, chunkOn.x, chunkOn.y);
		const chunkSeed = GameWorldSim.makeChunkSeed(planet, chunkOn.x, chunkOn.y);
		this.chunkItems[chunkId] = this.makeChunkItems(chunkSeed);
		const ship = this.makeChunkItem({
			x: 10,
			y: 10,
			isShip: true,
		});
		this.chunkItems[chunkId].push(ship);
	}

	giveElement(nomad, element, quantity) {
		let quantLeftToGive = quantity;
		const elementsInInvWithSpace = nomad.inventory.filter((invItem) => (
			invItem.element === element && invItem.quantity < invItem.max
		));
		elementsInInvWithSpace.forEach((invItem) => {
			const space = invItem.max - invItem.quantity;
			const give = Math.min(quantLeftToGive, space);
			invItem.quantity += give;
			quantLeftToGive -= give;
		});
		if (quantLeftToGive <= 0) return;
		if (nomad.inventory.length >= MAX_IVENTORY) {
			// TODO: inventory full message?
			return;
		}
		nomad.inventory.push({
			name: 'Unknown',
			max: 1,
			...INV_ITEMS[element],
			quantity: 0,
		});
		this.giveElement(nomad, element, quantLeftToGive);
	}

	addAction(action = {}) {
		this.actionQueue.push(action);
	}

	triggerClientEvent(nomadId, what, data) {
		const { hooks } = this;
		if (hooks[what]) hooks[what](data);
	}

	makeChunkItem(itemData = {}) {
		return {
			id: uid(),
			x: 0,
			y: 0,
			size: 1,
			hp: 1,
			...itemData,
		};
	}

	makeChunkItems(chunkSeed) {
		const chunkRandomizer = new PseudoRandomizer(chunkSeed);
		// How many items per chunk? 90% of the time there is one, otherwise there could be a bunch
		let n = chunkRandomizer.random(100);
		if (n < 10) n = 0;
		else if (n < 90) n = 1;
		else n = 101 - n;
		const items = [];
		for (let i = 0; i < n; i += 1) {
			const x = chunkRandomizer.random(CHUNK_PIXEL_SIZE);
			const y = chunkRandomizer.random(CHUNK_PIXEL_SIZE);
			const size = chunkRandomizer.random(MAX_ITEM_SIZE);
			const hp = 10 + size * 2;
			const element = chunkRandomizer.pick(['C', 'H', 'Na']);
			items.push(this.makeChunkItem({ x, y, size, element, hp }));
		}
		return items;
	}

	getChunkItems(chunkId, chunkSeed) {
		if (!this.chunkItems[chunkId]) {
			this.chunkItems[chunkId] = this.makeChunkItems(chunkSeed);
		}
		return this.chunkItems[chunkId];
	}

	getChunk(planet, x, y) { // chunk coordinates
		const seed = GameWorldSim.makeChunkSeed(planet, x, y);
		const id = GameWorldSim.makeChunkId(planet, x, y);
		return { id, x, y, seed, items: this.getChunkItems(id, seed) };
	}

	getNomadChunks(nomadId) {
		// TODO: Find nomad's planet and their location, and the chunks they are on
		const nomad = this.nomads[nomadId];
		const chunkOn = GameWorldSim.getChunkCoordinatesAt(nomad.x, nomad.y);
		const extraChunks = 1; // +1 and -1, for 3x3 chunks, or 9 total
		const chunks = [];
		for (let y = (chunkOn.y - extraChunks); y <= (chunkOn.y + extraChunks); y += 1) {
			for (let x = (chunkOn.x - extraChunks); x <= (chunkOn.x + extraChunks); x += 1) {
				chunks.push(this.getChunk(this.planet, x, y));
			}
		}
		return { chunkOn, extraChunks, chunks, nomads: this.nomads };
	}

	findTerrainItemsInRange(planet, planetCoordinates, range = 1) {
		const { x, y } = planetCoordinates;
		const chunkCoords = GameWorldSim.getChunkCoordinatesAt(x, y);
		const chunk = this.getChunk(planet, chunkCoords.x, chunkCoords.y);
		const chunkWorldCoords = GameWorldSim.convertChunkCoordinatesToWorld(chunkCoords);
		// console.log(x, y, 'chunk:', chunk.x, chunk.y,
		// chunkWorldCoords.x, chunkWorldCoords.y, chunk.items);
		return chunk.items.filter((item) => {
			const itemWorldX = chunkWorldCoords.x + item.x;
			const itemWorldY = chunkWorldCoords.y + item.y;
			const dist = calcVectorLength(itemWorldX, itemWorldY, x, y);
			// console.log(itemWorldX, itemWorldY, dist);
			return (dist <= range);
		});
	}

	updateActions() {
		if (this.actionQueue.length === 0) return;
		const [actionName, nomadId, actionDetails] = this.actionQueue.shift();
		const nomad = this.nomads[nomadId];
		if (actionName === 'move') {
			const { x = 0, y = 0 } = actionDetails;
			nomad.vel.x += x;
			nomad.vel.y += y;
			GameWorldSim.addPlanetCoordinates(nomad, actionDetails);
			// console.log('moving to', nomad.x, nomad.y);
		} else if (actionName === 'jump') {
			nomad.vel.z = 5;
			// console.log('jump');
		} else if (actionName === 'turn') {
			nomad.rotation = actionDetails.angle || 0;
		} else if (actionName === 'forward' || actionName === 'back') {
			const speed = (actionName === 'back') ? -4 : 7;
			const { x, y } = getXYCoordinatesFromPolar(nomad.rotation, speed);
			nomad.vel.x = x;
			nomad.vel.y = y;
		} else if (actionName === 'strafeLeft' || actionName === 'strafeRight') {
			const speed = (actionName === 'strafeRight') ? -4 : 4;
			const { x, y } = getXYCoordinatesFromPolar(nomad.rotation + Math.PI / 2, speed);
			nomad.vel.x = x;
			nomad.vel.y = y;
		} else if (actionName === 'drill') {
			const { x = 0, y = 0 } = actionDetails; // planet coordinates
			const { planet } = this; // TODO: get planet from nomad data
			const drilledItems = this.findTerrainItemsInRange(planet, { x, y }, 1);
			// const chunkOn = GameWorldSim.getChunkCoordinatesAt(x, y);
			// const { items } = this.getChunk(planet, chunkOn.x, chunkOn.y);

			drilledItems.forEach((item) => {
				if (item.hp <= 0) return;
				item.hp -= 1;
				const destroyed = (item.hp <= 0);
				const quantity = destroyed ? item.size : 1;
				if (item.element) this.giveElement(nomad, item.element, quantity);
				// if (destroyed || randInt(2) === 0) {
				// 	if (item.element) this.giveElement(nomad, item.element, quantity);
				// } else {
				// 	items.push(this.makeChunkItem({
				// 		x: item.x - 5 + randInt(11),
				// 		y: item.y - 5 + randInt(11),
				// 		size: 1,
				// 		element: item.element,
				// 		hp: 1,
				// 	}));
				// }
			});
			// TODO: Check the tick of the action to avoid drilling too many times in one tickw
		}
		if (this.actionQueue.length > 0) this.updateActions();
	}

	updatePhysics(timeMs) {
		const SCALE = 5; // magic number
		const time = (timeMs / 1000) * SCALE;
		this.nomadIds.forEach((nId) => {
			const nomad = this.nomads[nId];
			// const ogVelZ = nomad.vel.z;
			if (nomad.z > 0) {
				nomad.vel.z -= 4 * time;
			} else if (nomad.z < 0) {
				nomad.vel.z = 0;
				nomad.z = 0;
			}
			const fallingMultiplier = (nomad.vel.z < 0) ? 2 : 1;
			nomad.z += nomad.vel.z * time * fallingMultiplier;
			nomad.x += nomad.vel.x * time;
			nomad.y += nomad.vel.y * time;
			// Velocity calculations: Friction, max, settle to zero
			const frictionMultiplier = ((nomad.z === 0) ? 0.96 : 0.992);
			nomad.vel.y *= frictionMultiplier;
			nomad.vel.x *= frictionMultiplier;
			const clampedVel = vec2(nomad.vel).clampLength(MAX_NOMAD_VEL);
			nomad.vel.x = clampedVel.x;
			nomad.vel.y = clampedVel.y;
			if (abs(nomad.vel.x) < 0.001) nomad.vel.x = 0;
			if (abs(nomad.vel.y) < 0.001) nomad.vel.y = 0;
			// console.log(nomad.z, ogVelZ, nomad.vel.z, time);
		});
	}

	async update(timeMs) {
		this.tick += 1;
		if (this.tick > 999999) this.tick = 0;
		// TODO - More simulation
		this.updateActions();
		this.updatePhysics(timeMs);

		this.nomadIds.forEach((nId) => {
			const nomad = { ...this.nomads[nId] };
			nomad.x = round(nomad.x);
			nomad.y = round(nomad.y);
			const nomadWorldData = {
				planetSeed: this.planet.seed,
				tick: this.tick,
				...this.getNomadChunks(nId),
				nomad,
			};
			this.triggerClientEvent(nId, 'world', nomadWorldData);
		});
	}

	async next() {
		const t = 12;
		await this.update(t);
		await GameWorldSim.wait(t); // Close to 16.67 which is 1000 ms / 60 (fps)
		if (this.started) this.next();
	}

	start() {
		this.started = true;
		this.next();
	}

	stop() {
		this.started = false;
	}

	async init() {
		console.log(this);
		// TODO
	}
}
