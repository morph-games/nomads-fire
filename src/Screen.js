const { round, abs, sign } = Math;

export default class Screen {
	constructor(width, height, canvasId) {
		this.canvasId = canvasId;
		this.canvas = null;
		this.ctx = null;
		this.width = width;
		this.height = height;
		this.centerX = this.width / 2;
		this.centerY = this.height / 2;
	}

	async init() {
		// Please run after the DOM is ready
		const { document } = window;
		this.canvas = document.getElementById(this.canvasId || '');
		if (!this.canvas) {
			this.canvas = document.createElement('canvas'); // unattached from the DOM
		}
		this.canvas.height = this.height;
		this.canvas.width = this.width;
		this.ctx = this.canvas.getContext('2d');
		this.clear();
	}

	getPageCenter() {
		const rect = this.canvas.getBoundingClientRect();
		// console.log(rect);
		return {
			x: rect.x + rect.width / 2,
			y: rect.y + rect.height / 2,
		};
	}

	getImage() {
		const image = new Image();
		image.id = Number(new Date());
		image.src = this.canvas.toDataURL();
		return image;
	}

	drawImage(image, x = 0, y = 0) {
		this.ctx.drawImage(image, x, y);
	}

	drawCenterImage(image, x = 0, y = 0) {
		this.ctx.drawImage(image, this.centerX + x, this.centerY + y);
	}

	drawPixel(x, y, style) {
		this.fillRect(x, y, 1, 1, style);
	}

	drawCenterLine(x = 0, y = 0, endX = 0, endY = 0, strokeStyle = 'black') {
		// lineWidth = 1, offset = 0.5) {
		let x0 = round(x + this.centerX);
		let y0 = round(y + this.centerY);
		const x1 = round(endX + this.centerX);
		const y1 = round(endY + this.centerY);
		// Bresenham Algorithm from https://stackoverflow.com/a/4672319/1766230
		const dx = abs(x1 - x0);
		const dy = abs(y1 - y0);
		const sx = sign(x1 - x0);
		const sy = sign(y1 - y0);
		let err = dx - dy;

		while (true) {
			this.drawPixel(x0, y0, strokeStyle);
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy;
				x0 += sx;
			}
			if (e2 < dx) {
				err += dx;
				y0 += sy;
			}
		}

		// this.ctx.beginPath();
		// this.ctx.lineWidth = lineWidth;
		// const centerX = this.centerX + offset;
		// const centerY = this.centerY + offset;
		// this.ctx.moveTo(centerX + x, centerY + y);
		// this.ctx.lineTo(centerX + endX, centerY + endY);
		// this.ctx.strokeStyle = strokeStyle;
		// this.ctx.stroke(); // Render the path
	}

	clear() {
		this.ctx.clearRect(0, 0, this.width, this.height);
	}

	fillRect(x, y, w, h, fillStyle) {
		if (fillStyle) this.ctx.fillStyle = fillStyle;
		this.ctx.fillRect(round(x), round(y), round(w), round(h));
	}
}
