export function canAffordBuildRecipe(builder, recipe) {
	if (!builder.inventory || !builder.inventory.length) return false;
	const getElementTotal = (element) => {
		let total = 0;
		builder.inventory.forEach((invItem) => {
			if (invItem.element !== element) return;
			total += invItem.quantity;
		});
		return total;
	};
	let canAfford = true;
	recipe.resourceCost.forEach((costString) => {
		const [element, amountString] = costString.split(':');
		if (Number(amountString) > getElementTotal(element)) canAfford = false;
	});
	return canAfford;
}

export function getAffordableBuildRecipe(builder, thing) {
	if (!thing || !thing.recipes || !thing.recipes.length) return false;
	const affordableRecipes = thing.recipes.filter(
		(recipe) => canAffordBuildRecipe(builder, recipe),
	);
	return affordableRecipes.length ? affordableRecipes[0] : null; // Take the first one found
}

export function canAffordToBuild(builder, thing) {
	const recipe = getAffordableBuildRecipe(builder, thing);
	if (!recipe) return false;
	return canAffordBuildRecipe(builder, recipe);
}

/** Mutates the builder's inventory */
export function payBuildRecipe(builder, thing) {
	const recipe = getAffordableBuildRecipe(builder, thing);
	if (!recipe) return false;
	// Now pay it
	recipe.resourceCost.forEach((costString) => {
		const [element, amountString] = costString.split(':');
		let leftToPay = Number(amountString);
		builder.inventory.forEach((invItem) => {
			if (leftToPay <= 0) return;
			// TODO: Better to find lowest quantities first?
			if (invItem.element === element) {
				const pay = Math.max(Math.min(invItem.quantity, leftToPay), 0);
				invItem.quantity -= pay; // eslint-disable-line no-param-reassign
				leftToPay -= pay;
			}
		});
	});
	return true;
}

// getTotalCarbon(nomad) {
// const totalC = nomad.inventory.filter((invItem) => invItem.element === 'C')
// .reduce((sum, invItem) => (sum + invItem.quantity), 0);
// return totalC;
// }
