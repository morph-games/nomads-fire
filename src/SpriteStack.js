// import { loopPixelData } from './utils.js';
import Palette from './Palette.js';

const { PI, round } = Math;
const TWO_PI = PI * 2;

export default class SpriteStack {
	constructor(spritesImage, width, stackCount) {
		this.sourceSpritesImage = spritesImage;
		this.imageHeight = spritesImage.height;
		this.imageWidth = width || spritesImage.height;
		this.stackCount = stackCount; // TODO: calculate from width as a default
		// TODO LATER: allow customizing direction: bottom-to-top, top-to-bottom
		this.stackedCanvas = this.makeCanvas();
		this.rotationsToCache = 64;
		this.rotationOffset = 0;
		this.angleDelta = TWO_PI / this.rotationsToCache;
		this.cachedStackImages = {};
		this.palette = new Palette(spritesImage);
	}

	static makeCanvas(w = 12, h = 12) {
		const c = window.document.createElement('canvas');
		c.width = w;
		c.height = h;
		return c;
	}

	static getCanvasImage(canvas) {
		const image = new Image();
		image.src = canvas.toDataURL();
		return image;
	}

	static normalizeRotation(rotation) {
		return (rotation + TWO_PI) % TWO_PI;
	}

	correctColors() {
		this.palette.correct(this.stackedCanvas, { alphaCutoff: 100 });
		return this;
	}

	getRotationKey(rotation) {
		const r = SpriteStack.normalizeRotation(rotation);
		const index = round(r / this.angleDelta);
		if (index === this.rotationsToCache) return 'R0';
		return `R${index}`;
	}

	makeCanvas() {
		this.stackedCanvas = SpriteStack.makeCanvas(
			Math.ceil(Math.sqrt(this.imageWidth ** 2 + this.imageHeight ** 2)),
			this.sourceSpritesImage.height + this.stackCount,
		);
		return this.stackedCanvas;
	}

	stack(rotation = 0) {
		const ctx = this.stackedCanvas.getContext('2d');
		ctx.save();
		const { width, height } = this.stackedCanvas;
		const centerX = width / 2;
		const footerY = (height / 2) + (this.stackCount / 2);
		const halfImageWidth = this.imageWidth / 2;
		const halfImageHeight = this.imageHeight / 2;
		ctx.clearRect(0, 0, width, height);
		for (let i = 0; i < this.stackCount; i += 1) {
			ctx.save();
			ctx.translate(centerX, footerY - i);
			ctx.rotate(-rotation + this.rotationOffset);
			ctx.translate(-halfImageWidth, -halfImageHeight);
			ctx.drawImage(
				this.sourceSpritesImage,
				// Source XY
				i * this.imageWidth,
				0,
				// source dimensions
				this.imageWidth,
				this.imageHeight,
				// Destination XY - want to be near zero because of the rotation
				0.5,
				0,
				// Destination dimensions
				this.imageWidth,
				this.imageHeight,
			);
			// ctx.setTransform(1, 0, 0, 1, 0, 0);
			// ctx.rotate(rotation);
			ctx.restore();
		}
		// ctx.rotate(-rotation);
		ctx.restore();
		return this;
	}

	cacheAllRotationImages() {
		const angleDelta = TWO_PI / this.rotationsToCache;
		this.cachedStackImages = {};
		for (let r = 0; r < TWO_PI; r += angleDelta) {
			this.cachedStackImages[this.getRotationKey(r)] = this.stack(r)
				.correctColors().getImage();
		}
	}

	getCanvas() {
		return this.stackedCanvas;
	}

	getImage() {
		return SpriteStack.getCanvasImage(this.stackedCanvas);
	}

	getRotatedImage(rotation = 0) {
		const rotationKey = this.getRotationKey(rotation);
		// console.log(roundedRot)
		if (this.cachedStackImages[rotationKey]) return this.cachedStackImages[rotationKey];
		console.log('regenerating', rotation, rotationKey);
		return this.stack(rotation).getImage();
	}
}
