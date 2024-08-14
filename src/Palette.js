import { loopPixelData } from './utils.js';

export default class Palette {
	constructor(image) {
		this.obj = {};
		this.arr = [];
		if (image) this.collect(image);
	}

	static calcColorDistance([r0, g0, b0], [r1, g1, b1]) {
		return (r1 - r0) ** 2 + (g1 - g0) ** 2 + (b1 - b0) ** 2;
	}

	static makeImageCanvas(image) {
		const c = window.document.createElement('canvas');
		c.width = image.width;
		c.height = image.height;
		const ctx = c.getContext('2d');
		ctx.drawImage(image, 0, 0, image.width, image.height);
		return c;
	}

	static getPaletteArrayFromObject(obj) {
		return Object.keys(obj).map((key) => obj[key]);
	}

	static collectPaletteObject(image) {
		const c = Palette.makeImageCanvas(image);
		const paletteObject = {};
		loopPixelData(c, (r, g, b, a) => {
			if (r === 0 && g === 0 && b === 0 && a === 0) return;
			const arr = [r, g, b, a];
			const key = arr.join('_');
			paletteObject[key] = arr;
		});
		return paletteObject;
	}

	collect(image) {
		const paletteObject = Palette.collectPaletteObject(image);
		console.log(paletteObject);
		this.obj = paletteObject;
		this.arr = Palette.getPaletteArrayFromObject(paletteObject);
	}

	getClosestColor(r, g, b, paletteArray = this.arr) {
		let closestColor = null;
		let closestDist = Infinity;
		const myColorArr = [r, g, b];
		paletteArray.forEach((cArr) => {
			const d = Palette.calcColorDistance(cArr, myColorArr);
			if (d < closestDist) {
				closestDist = d;
				closestColor = cArr;
			}
		});
		return [...closestColor];
	}

	correct(canvas = this.stackedCanvas, options = {}) {
		let fixed = 0;
		// console.log(this.arr);
		const { alphaCutoff } = options;
		const { ctx, imageData } = loopPixelData(canvas, (r, g, b, a, data, i) => {
			if (a < alphaCutoff) {
				data[i] = 0;
				data[i + 1] = 0;
				data[i + 2] = 0;
				data[i + 3] = 0;
				fixed += 1;
				return;
			}
			const arr = [r, g, b, a];
			const key = arr.join('_');
			if (this.obj[key]) return;
			const [newR, newG, newB] = this.getClosestColor(r, g, b, this.arr);
			// console.log(r,g,b, newR, newG, newB);
			data[i] = newR;
			data[i + 1] = newG;
			data[i + 2] = newB;
			data[i + 3] = 255;
			fixed += 1;
			// ctx.fillStyle = correctedColor;
			// ctx.fillRect()
		});
		// console.log(fixed);
		// ctx.clearRect(0, 0, w, h);
		ctx.putImageData(imageData, 0, 0);
		return this;
	}
}
