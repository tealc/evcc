<template>
	<span class="absence-icon" :style="{ backgroundColor: meta.color }">
		<component :is="`shopicon-regular-${meta.icon}`" size="s"></component>
	</span>
</template>

<script lang="ts">
import "@h2d2/shopicons/es/regular/laptop";
import "@h2d2/shopicons/es/regular/book1";
import "@h2d2/shopicons/es/regular/cart1";
import "@h2d2/shopicons/es/regular/rollerblades";
import "@h2d2/shopicons/es/regular/partner";
import "@h2d2/shopicons/es/regular/location";
import "@h2d2/shopicons/es/regular/palmtree";
import "@h2d2/shopicons/es/regular/threedotshorizontal";
import { defineComponent } from "vue";
import { occasionMeta } from "./absences";

export default defineComponent({
	name: "AbsenceIcon",
	props: {
		occasion: { type: String, default: "other" },
	},
	computed: {
		meta() {
			return occasionMeta(this.occasion);
		},
	},
});
</script>

<style scoped>
.absence-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 2rem;
	height: 2rem;
	border-radius: 50%;
	color: var(--bs-white);
}
</style>
