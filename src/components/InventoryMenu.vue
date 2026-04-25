<script setup>
import { computed } from 'vue';

const props = defineProps({
	state: { type: Object },
	emitEvent: { type: Function },
});

const inventory = computed(() => {
	const inv = [...props.state.nomad.inventory].map((item, i) => ({ ...item, invId: i }));
	const totalSlots = 12;
	const paddingCount = totalSlots - inv.length;
	for (let i = 0; i < paddingCount; i += 1) {
		inv.push({ invId: inv.length, empty: true });
	}
	return inv;
});

const getItemClass = (item) => {
	return {
		'inventory-list-item': true,
		'item--empty': item.empty,
		// [`rarity-${item.rarity}`]: !item.empty && item.rarity
	};
};

</script>
<template>
	<div class="inventory-menu">
		<h1>Equipment</h1>
		<ul class="inventory-list">
			<li class="inventory-list-item"
				v-for="invItem in inventory"
				v-bind:key="invItem.invId"
				:class="getItemClass(invItem)"
				:title="invItem.name">
				<div class="inventory-list-item-name">
					{{  invItem.element || invItem.name || '' }}
				</div>
				<div class="item-count" v-if="invItem.quantity">
					{{  invItem.quantity }}
				</div>
				<!--
				{{ JSON.stringify(invItem) }}
				-->
			</li>
		</ul>
	</div>
	<div class="key-tips">
		<span>Esc or Right click = Go Back</span>
	</div>
</template>
