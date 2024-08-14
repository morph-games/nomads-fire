export default class ImageLoader {
	static async loadImage(name) {
		const src = `./images/${name}`;
		const img = new Image();
		const loadPromise = new Promise((resolve) => { img.onload = resolve; });
		img.src = src;
		await loadPromise;
		return img;
	}

	static async loadImages(arr) {
		const imageLoadPromises = arr.map(
			(imageName) => ImageLoader.loadImage(imageName),
		);
		const results = await Promise.allSettled(imageLoadPromises);
		return results.map((r) => r.value);
	}
}
