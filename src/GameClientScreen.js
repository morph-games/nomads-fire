import Screen from './Screen.js';
import { SCREEN_SIZE } from './constants.js';

export default class GameClientScreen extends Screen {
	constructor() {
		super(SCREEN_SIZE, SCREEN_SIZE, 'c');
	}

	static async make() {
		const gcs = new GameClientScreen();
		await gcs.init();
		return gcs;
	}
}
