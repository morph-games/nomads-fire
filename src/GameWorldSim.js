import { CHUNK_PIXEL_SIZE, PLANET_PIXEL_SIZE } from './constants.js';
import { vec2, getXYCoordinatesFromPolar } from './utils.js';

const MAX_NOMAD_VEL = 20;

const { round, abs } = Math;

export default class GameWorldSim {
	constructor(name, seed = 1000) {
		this.name = name;
		this.seed = seed;
		this.planetSeed = seed;
		this.actionQueue = [];
		this.nomads = {};
		this.nomadIds = [];
		this.started = false;
		this.hooks = {};
		this.actionQueue = [];
	}

	static async make(name, seed = 1000) {
		const gws = new GameWorldSim(name, seed);
		await gws.init();
		return gws;
	}

	static wait(ms = 1) {
		return new Promise((resolve) => { setTimeout(resolve, ms); });
	}

	static getChunkOn(planetX, planetY) {
		const getChunkCoord = (n) => Math.floor(
			((n >= 0) ? n : (PLANET_PIXEL_SIZE + n)) / CHUNK_PIXEL_SIZE,
		);
		return { x: getChunkCoord(planetX), y: getChunkCoord(planetY) };
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

	join(nomadId, details = {}) {
		const { nomads, nomadIds } = this;
		if (nomads[nomadId]) return; // already there
		nomadIds.push(nomadId);
		nomads[nomadId] = {
			...details,
			galaxyIndex: 0,
			system: { sectorX: 0, sectorY: 0, systemIndex: 0 },
			planetIndex: 0,
			x: Math.round(PLANET_PIXEL_SIZE / 2),
			y: Math.round(PLANET_PIXEL_SIZE / 2),
			z: 0,
			vel: { x: 0, y: 0, z: 0 },
			rotation: 0, // 0 = down, PI = up, positive half pi = right, negative half pi = left
		};
	}

	addAction(action = {}) {
		this.actionQueue.push(action);
	}

	triggerClientEvent(nomadId, what, data) {
		const { hooks } = this;
		if (hooks[what]) hooks[what](data);
	}

	getNomadChunks(nomadId) {
		// TODO: Find nomad's planet and their location, and the chunks they are on

		const nomad = this.nomads[nomadId];
		const chunkOn = GameWorldSim.getChunkOn(nomad.x, nomad.y);
		const extraChunks = 1; // +1 and -1, for 3x3 chunks, or 9 total
		const chunks = [];
		for (let y = (chunkOn.y - extraChunks); y <= (chunkOn.y + extraChunks); y += 1) {
			for (let x = (chunkOn.x - extraChunks); x <= (chunkOn.x + extraChunks); x += 1) {
				const seed = Math.round(
					this.planetSeed + (Math.sin(x) * 1000) + (Math.sin(y) * 999),
				);
				chunks.push({ x, y, seed });
			}
		}
		return { chunkOn, extraChunks, chunks, nomads: this.nomads };
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
			const speed = (actionName === 'back') ? -7 : 10;
			const { x, y } = getXYCoordinatesFromPolar(nomad.rotation, speed);
			nomad.vel.x = x;
			nomad.vel.y = y;
		} else if (actionName === 'strafeLeft' || actionName === 'strafeRight') {
			const speed = (actionName === 'strafeRight') ? -7 : 7;
			const { x, y } = getXYCoordinatesFromPolar(nomad.rotation + Math.PI / 2, speed);
			nomad.vel.x = x;
			nomad.vel.y = y;
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
			} else if (nomad.vel.z < 0) {
				nomad.vel.z = 0;
			}
			const fallingMultiplier = (nomad.vel.z < 0) ? 2 : 1;
			nomad.z += nomad.vel.z * time * fallingMultiplier;
			nomad.x += nomad.vel.x * time;
			nomad.y += nomad.vel.y * time;
			// Velocity calculations: Friction, max, settle to zero
			const frictionMultiplier = ((nomad.z === 0) ? 0.98 : 0.999);
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
		// TODO - More simulation
		this.updateActions();
		this.updatePhysics(timeMs);

		this.nomadIds.forEach((nId) => {
			const nomad = { ...this.nomads[nId] };
			nomad.x = round(nomad.x);
			nomad.y = round(nomad.y);
			const nomadWorldData = {
				planetSeed: this.planetSeed,
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
