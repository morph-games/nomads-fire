import GameClient from './GameClient.js';

const gc = new GameClient();

async function start() {
	await gc.init();
	await gc.startLocalGameWorldSim();
}

window.gc = gc;

start();
