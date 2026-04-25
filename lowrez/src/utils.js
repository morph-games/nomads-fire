// import { vec3, deg2rad } from './Vector3.js';
import Vector2 from './libs/Vector2.js';

function loop(n, fn) {
	for (let i = 0; i < n; i += 1) { fn(i, n); }
}
const { sin, cos, PI } = Math;
const TWO_PI = PI * 2;

function calcVectorLength(x1, y1, x2 = 0, y2 = 0) {
	return ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5;
}

function getXYCoordinatesFromPolar(angle, r) { // aka. polarToCartesian
	// Sometimes does it make sense to have x and y alternated?w
	const y = r * Math.cos(angle);
	const x = r * Math.sin(angle);
	return { x, y };
}

// function rotateByDegree(v, o) {
// return v.rotate(deg2rad(o.rx), deg2rad(o.ry), deg2rad(o.rz));
// }

// function getDirectionUnit(o) {
// const { facing } = o;
// return rotateByDegree(vec3(facing), o);
// }

function addAngles(a, b) {
	let { rx, ry, rz } = a;
	rx += b.rx;
	ry += b.ry;
	rz += b.rz;
	return { rx, ry, rz };
}

const wait = (ms) => (new Promise((resolve) => { setTimeout(resolve, ms); }));

// Some functions here from LittleJS utilities
function clamp(value, min = 0, max = 1) {
	return value < min ? min : value > max ? max : value; // eslint-disable-line no-nested-ternary
}
function lerp(percent, valueA, valueB) { return valueA + clamp(percent) * (valueB - valueA); }
function rand(valueA = 1, valueB = 0) { return valueB + Math.random() * (valueA - valueB); }
function randInt(valueA, valueB = 0) { return Math.floor(rand(valueA, valueB)); }
/**
 * Create a 2d vector, can take another Vector2 to copy, 2 scalars, or 1 scalar
 * @param {(Number|Vector2)} [x]
 * @param {Number} [y]
 * @return {Vector2}
 * @example
 * let a = vec2(0, 1); // vector with coordinates (0, 1)
 * let b = vec2(a);    // copy a into b
 * a = vec2(5);        // set a to (5, 5)
 * b = vec2();         // set b to (0, 0)
 * @memberof Utilities
 */
function vec2(x = 0, y = undefined) {
	return typeof x === 'number' ? new Vector2(x, y === undefined ? x : y) : new Vector2(x.x, x.y);
}

// Others
function pick(arr) { return arr[randInt(0, arr.length)]; }
function uid() { return String(Number(new Date())) + randInt(999); }

// Graphics
function loopPixelData(canvas, callback) {
	const ctx = canvas.getContext('2d');
	const { width, height } = canvas;
	const imageData = ctx.getImageData(0, 0, width, height);
	const { data } = imageData;
	for (let i = 0; i < data.length; i += 4) {
		callback(data[i], data[i + 1], data[i + 2], data[i + 3], data, i);
	}
	return { imageData, ctx, data, width, height };
}

export {
	loop, sin, cos,
	PI, TWO_PI,
	calcVectorLength,
	getXYCoordinatesFromPolar,
	uid,
	// rotateByDegree,
	// getDirectionUnit,
	addAngles,
	clamp,
	lerp,
	rand,
	randInt,
	pick,
	wait,
	vec2,
	Vector2,
	loopPixelData,
};
