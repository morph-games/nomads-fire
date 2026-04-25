<script setup>
import ENTITY_TYPES from '../entityTypes.js';

const props = defineProps({
	state: { type: Object },
	emitEvent: { type: Function },
});

function selectDeployable(deployable) {
	props.emitEvent({ action: 'selectDeployable', deployable });
}

const deployables = Object.values(ENTITY_TYPES).filter((entType) => entType.deployable);
</script>
<template>
	<div class="build-menu">
		<h1>Deployable Technology</h1>
		<ul class="build-deployable-list">
			<li v-for="deployable in deployables" v-bind:key="deployable.key"
				@click="selectDeployable(deployable)">
				{{ deployable.name }}
			</li>
		</ul>
	</div>
	<div class="key-tips">
		<span>Left click = Select</span>
		<span>Esc or Right click = Go Back</span>
	</div>
</template>
