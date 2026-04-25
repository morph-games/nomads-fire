export const CHUNK_PIXEL_SIZE = 64; // 1280
export const PLANET_CHUNK_SIZE = 1000;
export const SCREEN_SIZE = 64;
export const PLANET_PIXEL_SIZE = PLANET_CHUNK_SIZE * CHUNK_PIXEL_SIZE;
export const NOMAD_PIXEL_SIZE = 10;
export const SHIP_PIXEL_SIZE = 16;
export const ITEM_PIXEL_SIZE = 8;
export const NOMAD_HALF_SIZE = Math.ceil(NOMAD_PIXEL_SIZE / 2);
export const SHIP_HALF_SIZE = Math.ceil(SHIP_PIXEL_SIZE / 2);
export const INV_ITEMS = {
	C: { name: 'Carbon', element: 'C', max: 64, color: '#9a3846' },
	Na: { name: 'Sodium', element: 'Na', max: 64, color: '#d5b14f' },
	H: { name: 'Di-Hydrogen', element: 'H', max: 64, color: '#4a5bb1' },
};
export const MAX_IVENTORY = 24;
export const MAX_TECHNOLOGY = 12;
