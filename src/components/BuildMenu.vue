<script setup>
import { ref, computed } from 'vue';
import { canAffordToBuild, getAffordableBuildRecipe } from '../inventoryUtils.js';
import ENTITY_TYPES from '../entityTypes.js';

const deployables = Object.values(ENTITY_TYPES).filter((entType) => entType.deployable);
const elements = Object.values(ENTITY_TYPES).filter((entType) => entType.element);

const props = defineProps({
	nomad: { type: Object },
	emitEvent: { type: Function },
});

const focus = ref(null); // Your "focus" (noun)

function selectDeployable(deployable) {
	if (canAffordToBuild(props.nomad, deployable)) {
		props.emitEvent({ action: 'selectDeployable', deployable });
	}
}

function focusOnDeployable(event, deployable) {
	if (!deployable) {
		focus.value = null;
		return;
	}
	const rect = event.target?.getBoundingClientRect() || null;
	focus.value = {
		deployable,
		style: {
			top: `${event.pageY}px`,
			left: `${Math.round(rect.right)}px`,
		},
		recipe: getAffordableBuildRecipe(props.nomad, deployable)
			|| deployable.recipes?.[0]
			|| [],
		canAfford: canAffordToBuild(props.nomad, deployable),
	};
}

</script>
<template>
	<div class="build-menu">
		<h1>Deployable Technology</h1>
		<ul class="build-deployable-list">
			<li v-for="deployable in deployables" v-bind:key="deployable.key"
				@click="selectDeployable(deployable)"
				@focusin="focusOnDeployable(deployable)"
				@pointerover="focusOnDeployable($event, deployable)"
				@pointermove="focusOnDeployable($event, deployable)"
				@pointerleave="focusOnDeployable"
				@pointercancel="focusOnDeployable">
				{{ deployable.name }}
			</li>
		</ul>
	</div>
	<div class="build-info" v-if="focus" :style="focus.style">
		<div>
			<div>{{ focus?.deployable?.name }}</div>
			<div>{{ focus?.deployable?.subTitle }}</div>
		</div>
		<div>{{ focus?.deployable?.whatItDoes }}</div>
		<div class="build-recipe" v-if="focus?.recipe">
			<!-- Recipe -->
			<div v-for="resource in focus?.recipe?.resourceCost">
				{{ resource }}
			</div>
			<!-- {{ JSON.stringify(focus?.recipe) }} -->
		</div>
		<div class="build-tips">
			<div v-if="focus?.canAfford">
				Click = Select Part and begin placement
			</div>
			<div v-if="!focus?.canAfford">
				Cannot afford yet
			</div>
		</div>
	</div>
	<div class="key-tips">
		<span>Left click = Select</span>
		<span>Esc or Right click = Go Back</span>
	</div>
</template>

<style scoped>
	.build-info {
		position: absolute;
		background: #0008;
		color: #fffefe;
		padding: 1em;
		text-align: left;
	}
	.build-recipe {
		border: solid 1px #fff4;
		border-width: 1px 0;
		margin: 1em 0;
		padding: 0.75em 0;
	}
	.build-tips {
		margin-top: 1em;
		color: #cfad9f;
	}
</style>
