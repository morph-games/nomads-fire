import {
	CHUNK_PIXEL_SIZE,
	PLANET_PIXEL_SIZE,
} from './constants.js';

export default class Planet {
	static getChunkCoordinatesAt(planetX, planetY) {
		const getChunkCoord = (n) => Math.floor(
			((n >= 0) ? n : (PLANET_PIXEL_SIZE + n)) / CHUNK_PIXEL_SIZE,
		);
		return { x: getChunkCoord(planetX), y: getChunkCoord(planetY) };
	}

	static convertChunkCoordinatesToPlantCoords(chunkCoords) {
		return { x: chunkCoords.x * CHUNK_PIXEL_SIZE, y: chunkCoords.y * CHUNK_PIXEL_SIZE };
	}
}
