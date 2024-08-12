const { PI } = Math;

export default class SpriteStack {
	constructor(spritesImage, width, stackCount) {
		this.sourceSpritesImage = spritesImage;
		this.imageHeight = spritesImage.height;
		this.imageWidth = width || spritesImage.height;
		this.stackCount = stackCount; // TODO: calculate from width as a default
		// TODO LATER: allow customizing direction: bottom-to-top, top-to-bottom
		this.stackedCanvas = this.makeCanvas();
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
		ctx.clearRect(0, 0, width, height);
		const xOffset = Math.round((width - this.imageWidth) / 2);
		for (let i = 0; i < this.stackCount; i += 1) {
			ctx.save();
			ctx.translate(width / 2, height / 2);
			ctx.rotate(-rotation);
			ctx.translate(width / -2, height / -2);
			ctx.drawImage(
				this.sourceSpritesImage,
				// Source XY
				i * this.imageWidth,
				0,
				// source dimensions
				this.imageWidth,
				this.imageHeight,
				// Destination XY
				xOffset,
				this.stackCount - i,
				// Destination dimensions
				this.imageWidth,
				this.imageHeight,
			);
			// ctx.rotate(rotation);
			ctx.restore();
		}
		// ctx.rotate(-rotation);
		ctx.restore();
		return this;
	}

	getCanvas() {
		return this.stackedCanvas;
	}

	getImage() {
		return SpriteStack.getCanvasImage(this.stackedCanvas);
	}
}
