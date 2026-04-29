<script setup>
import BuildMenu from './BuildMenu.vue';
import InventoryMenu from './InventoryMenu.vue';

// Define the prop to receive the state object
const props = defineProps({
	state: { type: Object },
	eventType: { type: String },
});

function emitEventToGameClient(detail = null) {
	const event = new CustomEvent(props.eventType, {
		detail,
		bubbles: true,
		composed: true,
	});
	window.dispatchEvent(event);
}

function handleRightClick() {
	emitEventToGameClient({ action: 'goBack' });
}

// To access it in logic: console.log(props.state);
</script>

<template>
	<div class="ui-inside" @contextmenu.prevent="handleRightClick">
		{{ state.open }}
		<InventoryMenu v-if="state.open === 'inv'"
			:state="state"
			:emit-event="emitEventToGameClient" />
		<BuildMenu v-if="state.open === 'build'"
			:nomad="state.nomad"
			:emit-event="emitEventToGameClient" />
	</div>
</template>
