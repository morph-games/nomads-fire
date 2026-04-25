const keyize = (objectOfObjects = {}) => {
	Object.keys(objectOfObjects).forEach(
		(key) => { objectOfObjects[key].key = key; }, // eslint-disable-line no-param-reassign
	);
	return objectOfObjects;
};
export const ENTITY_TYPES = keyize({
	ref1: {
		name: 'Refiner Mk.1',
		deployable: true,
		recipes: [{ resourceCost: ['Na:3'] }],
	},
	ref2: {
		name: 'Refiner Mk.2',
		deployable: true,
		recipes: [{ resourceCost: ['Fe:3', 'Na:2'] }],
	},
	ref3: {
		name: 'Refiner Mk.3',
		deployable: true,
		recipes: [{ resourceCost: ['Fe:3', 'Na:5'] }],
	},
	rasa1: {
		name: 'Starship',
		deployable: true,
		ship: 'rasa',
		hp: 1000,
		recipes: [{ resourceCost: ['Fe:3', 'Na:5'] }],
	},
});
export default ENTITY_TYPES;
