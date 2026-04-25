/* eslint-disable no-nested-ternary */

const { abs } = Math;

// From LittleJS: https://github.com/KilledByAPixel/LittleJS/blob/main/src/engineUtilities.js
/**
 * 2D Vector object with vector math library
 * - Functions do not change this so they can be chained together
 * @example
 * let a = new Vector2(2, 3); // vector with coordinates (2, 3)
 * let b = new Vector2;       // vector with coordinates (0, 0)
 * let c = vec2(4, 2);        // use the vec2 function to make a Vector2
 * let d = a.add(b).scale(5); // operators can be chained
 */
export default class Vector2 {
	/** Create a 2D vector with the x and y passed in, can also be created with vec2()
	 *  @param {Number} [x] - X axis location
	 *  @param {Number} [y] - Y axis location */
	constructor(x = 0, y = 0) {
		/** @property {Number} - X axis location */
		this.x = x;
		/** @property {Number} - Y axis location */
		this.y = y;
	}

	/** Returns a new vector that is a copy of this
	 *  @return {Vector2} */
	copy() { return new Vector2(this.x, this.y); }

	/** Returns a copy of this vector plus the vector passed in
	 *  @param {Vector2} v - other vector
	 *  @return {Vector2} */
	add(v) {
		// ASSERT(isVector2(v));
		return new Vector2(this.x + v.x, this.y + v.y);
	}

	/** Returns a copy of this vector minus the vector passed in
	 *  @param {Vector2} v - other vector
	 *  @return {Vector2} */
	subtract(v) {
		// ASSERT(isVector2(v));
		return new Vector2(this.x - v.x, this.y - v.y);
	}

	/** Returns a copy of this vector times the vector passed in
	 *  @param {Vector2} v - other vector
	 *  @return {Vector2} */
	multiply(v) {
		// ASSERT(isVector2(v));
		return new Vector2(this.x * v.x, this.y * v.y);
	}

	/** Returns a copy of this vector divided by the vector passed in
	 *  @param {Vector2} v - other vector
	 *  @return {Vector2} */
	divide(v) {
		// ASSERT(isVector2(v));
		return new Vector2(this.x / v.x, this.y / v.y);
	}

	/** Returns a copy of this vector scaled by the vector passed in
	 *  @param {Number} s - scale
	 *  @return {Vector2} */
	scale(s) {
		// ASSERT(!isVector2(s));
		return new Vector2(this.x * s, this.y * s);
	}

	/** Returns the length of this vector
	 * @return {Number} */
	length() { return this.lengthSquared() ** 0.5; }

	/** Returns the length of this vector squared
	 * @return {Number} */
	lengthSquared() { return this.x ** 2 + this.y ** 2; }

	/** Returns the distance from this vector to vector passed in
	 * @param {Vector2} v - other vector
	 * @return {Number} */
	distance(v) {
		// ASSERT(isVector2(v));
		return this.distanceSquared(v) ** 0.5;
	}

	/** Returns the distance squared from this vector to vector passed in
	 * @param {Vector2} v - other vector
	 * @return {Number} */
	distanceSquared(v) {
		// ASSERT(isVector2(v));
		return (this.x - v.x) ** 2 + (this.y - v.y) ** 2;
	}

	/** Returns a new vector in same direction as this one with the length passed in
	 * @param {Number} [length]
	 * @return {Vector2} */
	normalize(length = 1) {
		const l = this.length();
		return l ? this.scale(length / l) : new Vector2(0, length);
	}

	/** Returns a new vector clamped to length passed in
	 * @param {Number} [length]
	 * @return {Vector2} */
	clampLength(length = 1) {
		const l = this.length();
		return l > length ? this.scale(length / l) : this;
	}

	/** Returns the dot product of this and the vector passed in
	 * @param {Vector2} v - other vector
	 * @return {Number} */
	dot(v) {
		// ASSERT(isVector2(v));
		return this.x * v.x + this.y * v.y;
	}

	/** Returns the cross product of this and the vector passed in
	 * @param {Vector2} v - other vector
	 * @return {Number} */
	cross(v) {
		// ASSERT(isVector2(v));
		return this.x * v.y - this.y * v.x;
	}

	/** Returns the angle of this vector, up is angle 0
	 * @return {Number} */
	angle() { return Math.atan2(this.x, this.y); }

	/** Sets this vector with angle and length passed in
	 * @param {Number} [angle]
	 * @param {Number} [length]
	 * @return {Vector2} */
	setAngle(angle = 0, length = 1) {
		this.x = length * Math.sin(angle);
		this.y = length * Math.cos(angle);
		return this;
	}

	/** Returns copy of this vector rotated by the angle passed in
	 * @param {Number} angle
	 * @return {Vector2} */
	rotate(angle) {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		return new Vector2(this.x * c - this.y * s, this.x * s + this.y * c);
	}

	/** Set the integer direction of this vector, corrosponding to multiples of
	 * 90 degree rotation (0-3)
	 * @param {Number} [direction]
	 * @param {Number} [length] */
	setDirection(direction, length = 1) { // eslint-disable-line class-methods-use-this
		// ASSERT(direction == 0 || direction == 1 || direction == 2 || direction == 3);
		return new Vector2(
			direction % 2 ? direction - 1 ? -length : length : 0,
			direction % 2 ? 0 : direction ? -length : length,
		);
	}

	/** Returns the integer direction of this vector, corrosponding to multiples of
	 * 90 degree rotation (0-3)
	 * @return {Number} */
	direction() {
		return abs(this.x) > abs(this.y) ? this.x < 0 ? 3 : 1 : this.y < 0 ? 2 : 0;
	}

	/** Returns a copy of this vector that has been inverted
	 * @return {Vector2} */
	invert() { return new Vector2(this.y, -this.x); }

	/** Returns a copy of this vector with each axis floored
	 * @return {Vector2} */
	floor() { return new Vector2(Math.floor(this.x), Math.floor(this.y)); }

	/** Returns the area this vector covers as a rectangle
	 * @return {Number} */
	area() { return abs(this.x * this.y); }

	/** Returns a new vector that is p percent between this and the vector passed in
	 * @param {Vector2} v - other vector
	 * @param {Number}  percent
	 * @return {Vector2} */
	lerp(v, percent) {
		// ASSERT(isVector2(v));
		return this.add(v.subtract(this).scale(
			// clamp(percent)
			(percent < 0 ? 0 : percent > 1 ? 1 : percent),
		));
	}

	/** Returns true if this vector is within the bounds of an array size passed in
	 * @param {Vector2} arraySize
	 * @return {Boolean} */
	arrayCheck(arraySize) {
		// ASSERT(isVector2(arraySize));
		return this.x >= 0 && this.y >= 0 && this.x < arraySize.x && this.y < arraySize.y;
	}

	/** Returns this vector expressed as a string
	 * @param {Number} digits - precision to display
	 * @return {String} */
	toString(digits = 3) {
		// if (debug)
		return `(${(this.x < 0 ? '' : ' ') + this.x.toFixed(digits)},${(this.y < 0 ? '' : ' ') + this.y.toFixed(digits)} )`;
	}
}
