const keyize = (objectOfObjects = {}) => {
	Object.keys(objectOfObjects).forEach(
		(key) => { objectOfObjects[key].key = key; }, // eslint-disable-line no-param-reassign
	);
	return objectOfObjects;
};

const ELEMENT = { element: '?', stack: 64 };

export const ENTITY_TYPES = keyize({
	ref1: {
		name: 'Refiner Mk.1',
		subTitle: 'Turn things into other things',
		deployable: true,
		recipes: [{ resourceCost: ['Na:3'] }],
	},
	// ref2: {
	// 	name: 'Refiner Mk.2',
	// 	deployable: true,
	// 	recipes: [{ resourceCost: ['H:3', 'Na:2'] }],
	// },
	// ref3: {
	// 	name: 'Refiner Mk.3',
	// 	deployable: true,
	// 	recipes: [{ resourceCost: ['H:3', 'Na:5'] }],
	// },
	rasa1: {
		name: 'Starship',
		subTitle: 'Interstellar Flying Machine',
		deployable: true,
		ship: 'rasa',
		hp: 1000,
		recipes: [{ resourceCost: ['C:50', 'Na:50'] }],
	},
	// - - - - - - - - - - - - - Elements
	eltFe: {
		...ELEMENT,
		name: 'Ferrite',
		element: 'Fe',
		color: '#4a5bb1', // TODO: new color
	},
	eltC: {
		...ELEMENT,
		name: 'Carbon',
		element: 'C',
		color: '#9a3846',
	},
	eltNa: {
		...ELEMENT,
		name: 'Sodium',
		element: 'Na',
		color: '#d5b14f',
	},
	eltH: {
		...ELEMENT,
		name: 'Di-Hydrogen',
		element: 'H',
		color: '#4a5bb1',
	},
	eltO: {
		...ELEMENT,
		name: 'Oxygen',
		element: 'O2',
		color: '#4a5bb1', // TODO: new color
	},
});
export default ENTITY_TYPES;
