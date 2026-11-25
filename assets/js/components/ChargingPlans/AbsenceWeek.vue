<template>
	<div class="absence-week" data-testid="absence-week">
		<div class="week-row axis" aria-hidden="true">
			<span class="day"></span>
			<div class="track">
				<span
					v-for="h in hours"
					:key="h"
					class="tick-label"
					:style="{ left: `${(h / 24) * 100}%` }"
				>
					{{ h }}
				</span>
			</div>
		</div>
		<div
			v-for="(day, row) in days"
			:key="day.value"
			class="week-row"
			:class="{ today: row === todayRow }"
			data-testid="absence-week-row"
		>
			<span class="day">{{ day.name }}</span>
			<div class="track bar" :style="{ height: `${Math.max(1.25, lanes[row]! * 0.875)}rem` }">
				<span
					v-for="h in innerHours"
					:key="h"
					class="tick"
					:style="{ left: `${(h / 24) * 100}%` }"
				></span>
				<button
					v-for="(block, i) in blocksByRow[row]"
					:key="`${block.id}-${i}`"
					type="button"
					class="block"
					:class="{ inactive: !block.active, once: !block.repeat }"
					:style="blockStyle(block, lanes[row]!)"
					:title="blockTitle(block)"
					:aria-label="blockTitle(block)"
					data-testid="absence-week-block"
					@click="$emit('select', block.id)"
				></button>
				<span
					v-if="row === todayRow"
					class="now"
					:style="{ left: `${(nowMinutes / MINUTES_PER_DAY) * 100}%` }"
				></span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import formatter from "@/mixins/formatter";
import type { Absence } from "@/types/evcc";
import {
	MINUTES_PER_DAY,
	occasionMeta,
	laneBlocks,
	weekBlocks,
	weekdayToRow,
	type LanedBlock,
	type WeekBlock,
} from "./absences";

const fmtMinutes = (m: number) =>
	`${`${Math.floor(m / 60)}`.padStart(2, "0")}:${`${m % 60}`.padStart(2, "0")}`;

export default defineComponent({
	name: "AbsenceWeek",
	mixins: [formatter],
	props: {
		absences: { type: Array as PropType<Absence[]>, default: () => [] },
		now: { type: Date, default: () => new Date() },
	},
	emits: ["select"],
	data() {
		return { MINUTES_PER_DAY, hours: [0, 6, 12, 18, 24], innerHours: [6, 12, 18] };
	},
	computed: {
		days() {
			return this.getWeekdaysList("short");
		},
		todayRow(): number {
			return weekdayToRow(this.now.getDay());
		},
		nowMinutes(): number {
			return this.now.getHours() * 60 + this.now.getMinutes();
		},
		laned(): { rows: LanedBlock[][]; lanes: number[] } {
			return laneBlocks(weekBlocks(this.absences, this.now));
		},
		blocksByRow(): LanedBlock[][] {
			return this.laned.rows;
		},
		lanes(): number[] {
			return this.laned.lanes;
		},
	},
	methods: {
		blockStyle(block: LanedBlock, lanes: number) {
			return {
				top: `${(block.lane / lanes) * 100}%`,
				height: `${100 / lanes}%`,
				left: `${(block.start / MINUTES_PER_DAY) * 100}%`,
				width: `${((block.end - block.start) / MINUTES_PER_DAY) * 100}%`,
				backgroundColor: occasionMeta(block.occasion).color,
			};
		},
		blockTitle(block: WeekBlock): string {
			const occasion = this.$t(`main.chargingPlan.absences.occasions.${block.occasion}`);
			return `${occasion} ${fmtMinutes(block.start)} – ${fmtMinutes(block.end)}`;
		},
	},
});
</script>

<style scoped>
.absence-week {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	font-size: 0.75rem;
	color: var(--evcc-gray);
}
.week-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.week-row.today .day {
	color: var(--evcc-default-text);
	font-weight: bold;
}
.day {
	flex: 0 0 2rem;
	text-transform: capitalize;
}
.track {
	position: relative;
	flex: 1 1 auto;
	height: 1.25rem;
	min-width: 0;
}
.axis .track {
	height: 1rem;
}
.tick-label {
	position: absolute;
	top: 0;
	transform: translateX(-50%);
}
.tick-label:first-child {
	transform: none;
}
.tick-label:last-child {
	transform: translateX(-100%);
}
.bar {
	background-color: var(--evcc-gray-15);
	border-radius: 4px;
	overflow: hidden;
}
.tick {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 1px;
	background-color: var(--evcc-gray-25);
}
.block {
	position: absolute;
	box-shadow: inset 0 0 0 1px var(--evcc-box);
	min-width: 3px;
	padding: 0;
	border: 0;
	opacity: 0.9;
	cursor: pointer;
	transition: opacity var(--evcc-transition-fast) ease;
}
.block.once {
	background-image: repeating-linear-gradient(
		-45deg,
		transparent 0 4px,
		rgba(255, 255, 255, 0.25) 4px 8px
	);
}
.block.inactive {
	opacity: 0.25;
}
.block:hover,
.block:focus-visible {
	opacity: 1;
	outline: 2px solid var(--evcc-default-text);
	outline-offset: -2px;
	z-index: 1;
}
.now {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 2px;
	background-color: var(--evcc-default-text);
	pointer-events: none;
	z-index: 2;
}
</style>
