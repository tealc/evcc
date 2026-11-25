<template>
	<div data-testid="absences">
		<p class="evcc-gray small mb-3">{{ $t("main.chargingPlan.absences.description") }}</p>

		<AbsenceWeek v-if="absences.length" class="mb-3" :absences="absences" @select="select" />

		<p v-if="goalInAbsence" class="small text-warning mb-3" data-testid="absence-goal-hint">
			{{ $t("main.chargingPlan.absences.goalHint") }}
		</p>

		<div ref="list">
			<ChargingPlanAbsence
				v-for="absence in absences"
				:key="absence.id"
				:absence="absence"
				:expanded="expandedId === absence.id"
				:formIdPrefix="formIdPrefix"
				@toggle="toggle"
				@updated="update"
				@removed="remove"
				@cancel="expandedId = null"
			/>
			<ChargingPlanAbsence
				v-if="draft"
				:key="`new-${draft.id}`"
				:absence="draft"
				expanded
				isNew
				:formIdPrefix="formIdPrefix"
				@toggle="draft = null"
				@updated="add"
				@cancel="draft = null"
			/>
		</div>

		<div v-if="!draft" class="d-flex align-items-center pb-4">
			<button
				type="button"
				class="d-flex btn btn-sm btn-outline-secondary border-0 align-items-center gap-2 evcc-gray add"
				data-testid="absence-add"
				tabindex="0"
				@click="startAdd"
			>
				<shopicon-regular-plus size="s" class="flex-shrink-0"></shopicon-regular-plus>
				{{ $t("main.chargingPlan.absences.add") }}
			</button>
		</div>
	</div>
</template>

<script lang="ts">
import "@h2d2/shopicons/es/regular/plus";
import { defineComponent, type PropType } from "vue";
import formatter from "@/mixins/formatter";
import AbsenceWeek from "./AbsenceWeek.vue";
import PlanAbsence from "./PlanAbsence.vue";
import type { Absence, RepeatingPlan, StaticPlan } from "@/types/evcc";
import {
	addAbsence,
	dateInAbsence,
	newAbsence,
	removeAbsence,
	updateAbsence,
	weeklyGoalInAbsence,
} from "./absences";

export default defineComponent({
	name: "ChargingPlansAbsences",
	components: { AbsenceWeek, ChargingPlanAbsence: PlanAbsence },
	mixins: [formatter],
	props: {
		id: [Number, String],
		absences: { type: Array as PropType<Absence[]>, default: () => [] },
		staticPlan: Object as PropType<StaticPlan>,
		repeatingPlans: { type: Array as PropType<RepeatingPlan[]>, default: () => [] },
	},
	emits: ["updated"],
	data() {
		return {
			expandedId: null as string | null,
			draft: null as Absence | null,
		};
	},
	computed: {
		formIdPrefix(): string {
			return `absence-lp${this.id}`;
		},
		goalInAbsence(): boolean {
			const active = this.absences.filter((a) => a.active);
			if (!active.length) return false;
			if (this.staticPlan?.time && dateInAbsence(new Date(this.staticPlan.time), active)) {
				return true;
			}
			return this.repeatingPlans.some(
				(p) => p.active && weeklyGoalInAbsence(p.weekdays, p.time, active)
			);
		},
	},
	methods: {
		emitList(list: Absence[]): void {
			this.$emit("updated", list);
		},
		toggle(id: string): void {
			this.expandedId = this.expandedId === id ? null : id;
		},
		select(id: string): void {
			this.draft = null;
			this.expandedId = id;
			this.$nextTick(() => {
				const list = this.$refs["list"] as HTMLElement | undefined;
				list?.querySelector(`[data-testid="absence-entry-${id}"]`)?.scrollIntoView?.({
					behavior: "smooth",
					block: "nearest",
				});
			});
		},
		startAdd(): void {
			this.expandedId = null;
			this.draft = newAbsence(this.timezone(), this.absences);
		},
		add(absence: Absence): void {
			this.draft = null;
			this.emitList(addAbsence(this.absences, absence));
		},
		update(absence: Absence, collapse = true): void {
			if (collapse) this.expandedId = null;
			this.emitList(updateAbsence(this.absences, absence));
		},
		remove(id: string): void {
			this.expandedId = null;
			this.emitList(removeAbsence(this.absences, id));
		},
	},
});
</script>

<style scoped>
.add {
	margin-left: -0.5rem;
}
</style>
