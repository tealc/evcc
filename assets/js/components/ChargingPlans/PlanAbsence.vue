<template>
	<div class="absence" :class="{ expanded }" :data-testid="`absence-entry-${absence.id}`">
		<div class="d-flex align-items-center gap-3 py-2">
			<button
				type="button"
				class="summary btn btn-link p-0 d-flex align-items-center gap-3 text-start text-reset text-decoration-none flex-grow-1 min-w-0"
				:aria-expanded="expanded"
				data-testid="absence-toggle"
				@click="$emit('toggle', absence.id)"
			>
				<AbsenceIcon
					:occasion="absence.occasion"
					:class="{ 'opacity-50': !absence.active }"
				/>
				<span class="d-flex flex-column min-w-0">
					<span class="fw-semibold text-truncate">
						{{ occasionLabel(absence.occasion) }}
						<small class="fw-normal evcc-gray ms-1">
							{{
								$t(
									`main.chargingPlan.absences.${absence.repeat ? "weekly" : "once"}`
								)
							}}
						</small>
					</span>
					<small class="evcc-gray text-truncate" data-testid="absence-summary">
						{{ summary }}
					</small>
				</span>
			</button>
			<div v-if="!isNew" class="form-check form-switch m-0">
				<input
					:id="formId('active')"
					class="form-check-input"
					type="checkbox"
					role="switch"
					:checked="absence.active"
					:aria-label="$t('main.chargingPlan.active')"
					data-testid="absence-active"
					@change="toggleActive"
				/>
			</div>
		</div>

		<form v-if="expanded" class="edit pb-3" data-testid="absence-form" @submit.prevent="save">
			<div class="mb-3">
				<div class="form-label">{{ $t("main.chargingPlan.absences.occasion") }}</div>
				<div class="occasions" role="radiogroup">
					<button
						v-for="o in occasions"
						:key="o.value"
						type="button"
						role="radio"
						class="occasion btn btn-sm"
						:class="{ active: draft.occasion === o.value }"
						:aria-checked="draft.occasion === o.value"
						:data-testid="`absence-occasion-${o.value}`"
						@click="draft.occasion = o.value"
					>
						<AbsenceIcon :occasion="o.value" />
						<span class="text-truncate">{{ occasionLabel(o.value) }}</span>
					</button>
				</div>
			</div>

			<div class="mb-3">
				<SelectGroup
					:id="formId('repeat')"
					:modelValue="draft.repeat ? 'weekly' : 'once'"
					:options="repeatOptions"
					:ariaLabel="$t('main.chargingPlan.absences.repeat')"
					class="repeat-group"
					@update:model-value="draft.repeat = $event === 'weekly'"
				/>
			</div>

			<div v-if="draft.repeat" class="row g-2 mb-3">
				<div class="col-12 col-md-6">
					<label :for="formId('weekdays')" class="form-label">
						{{ $t("main.chargingPlan.weekdays") }}
					</label>
					<MultiSelect
						:id="formId('weekdays')"
						:value="draft.weekdays"
						:options="dayOptions"
						:selectAllLabel="$t('main.chargingPlan.selectAll')"
						data-testid="absence-weekdays"
						@update:model-value="draft.weekdays = $event"
					>
						{{ fmtWeekdaysRange(draft.weekdays || []) }}
					</MultiSelect>
				</div>
				<div class="col-6 col-md-3">
					<label :for="formId('start')" class="form-label">
						{{ $t("main.chargingPlan.absences.leave") }}
					</label>
					<input
						:id="formId('start')"
						v-model="draft.start"
						type="time"
						step="900"
						class="form-control"
						required
						data-testid="absence-start"
					/>
				</div>
				<div class="col-6 col-md-3">
					<label :for="formId('end')" class="form-label">
						{{ $t("main.chargingPlan.absences.return") }}
					</label>
					<input
						:id="formId('end')"
						v-model="draft.end"
						type="time"
						step="900"
						class="form-control"
						required
						data-testid="absence-end"
					/>
				</div>
				<div v-if="overnight" class="col-12">
					<small class="evcc-gray">{{ $t("main.chargingPlan.absences.nextDay") }}</small>
				</div>
			</div>

			<div v-else class="row g-2 mb-3">
				<div class="col-12 col-md-6">
					<label :for="formId('from')" class="form-label">
						{{ $t("main.chargingPlan.absences.leave") }}
					</label>
					<input
						:id="formId('from')"
						v-model="fromLocal"
						type="datetime-local"
						step="900"
						class="form-control"
						required
						data-testid="absence-from"
					/>
				</div>
				<div class="col-12 col-md-6">
					<label :for="formId('to')" class="form-label">
						{{ $t("main.chargingPlan.absences.return") }}
					</label>
					<input
						:id="formId('to')"
						v-model="toLocal"
						type="datetime-local"
						step="900"
						class="form-control"
						:class="{ 'is-invalid': rangeInvalid }"
						required
						data-testid="absence-to"
					/>
					<div v-if="rangeInvalid" class="invalid-feedback">
						{{ $t("main.chargingPlan.absences.invalidRange") }}
					</div>
				</div>
			</div>

			<div class="mb-3">
				<label :for="formId('energy')" class="form-label">
					{{ $t("main.chargingPlan.absences.energy") }}
					<small class="evcc-gray"
						>({{ $t("main.chargingPlan.absences.optional") }})</small
					>
				</label>
				<div class="input-group energy">
					<input
						:id="formId('energy')"
						v-model.number="draft.energy"
						type="number"
						min="0"
						step="0.5"
						inputmode="decimal"
						class="form-control"
						data-testid="absence-energy"
					/>
					<span class="input-group-text">kWh</span>
				</div>
				<div class="form-text">{{ $t("main.chargingPlan.absences.energyHelp") }}</div>
			</div>

			<div class="d-flex align-items-center gap-2">
				<button
					v-if="!isNew"
					type="button"
					class="btn btn-sm btn-link text-danger px-0 me-auto"
					data-testid="absence-remove"
					@click="$emit('removed', absence.id)"
				>
					{{ $t("main.chargingPlan.remove") }}
				</button>
				<button
					type="button"
					class="btn btn-sm btn-outline-secondary ms-auto"
					data-testid="absence-cancel"
					@click="$emit('cancel', absence.id)"
				>
					{{ $t("main.chargingPlan.absences.cancel") }}
				</button>
				<button
					type="submit"
					class="btn btn-sm btn-primary"
					:disabled="!valid"
					data-testid="absence-save"
				>
					{{ $t("main.chargingPlan.absences.save") }}
				</button>
			</div>
		</form>
	</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import formatter from "@/mixins/formatter";
import MultiSelect from "../Helper/MultiSelect.vue";
import SelectGroup from "../Helper/SelectGroup.vue";
import AbsenceIcon from "./AbsenceIcon.vue";
import deepClone from "@/utils/deepClone";
import type { Absence, AbsenceOccasion, SelectOption } from "@/types/evcc";
import {
	DAY_MS,
	OCCASIONS,
	floorQuarter,
	normalizeAbsence,
	parseTime,
	toLocalInput,
	toRFC3339,
} from "./absences";

const pad = (n: number) => `${n}`.padStart(2, "0");

/** round HH:MM to the nearest quarter hour */
function roundTime(time: string | undefined): string {
	const m = (Math.round(parseTime(time || "") / 15) * 15) % (24 * 60);
	return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** datetime-local value to RFC3339, rounded to the quarter hour */
function localInputToRFC3339(value: string): string {
	const d = new Date(value);
	if (isNaN(d.getTime())) return "";
	return toRFC3339(floorQuarter(new Date(d.getTime() + 7.5 * 60 * 1000)));
}

function rfcToLocalInput(value: string | undefined, fallback: Date): string {
	const d = value ? new Date(value) : fallback;
	return toLocalInput(isNaN(d.getTime()) ? fallback : d);
}

export default defineComponent({
	name: "ChargingPlanAbsence",
	components: { AbsenceIcon, MultiSelect, SelectGroup },
	mixins: [formatter],
	props: {
		absence: { type: Object as PropType<Absence>, required: true },
		expanded: Boolean,
		isNew: Boolean,
		formIdPrefix: { type: String, default: "absence" },
	},
	emits: ["toggle", "updated", "removed", "cancel"],
	data() {
		return {
			draft: deepClone(this.absence) as Absence,
			fromLocal: "",
			toLocal: "",
			occasions: OCCASIONS,
		};
	},
	computed: {
		repeatOptions(): SelectOption<string>[] {
			return [
				{ value: "weekly", name: this.$t("main.chargingPlan.absences.weekly") },
				{ value: "once", name: this.$t("main.chargingPlan.absences.once") },
			];
		},
		dayOptions(): SelectOption<number>[] {
			return this.getWeekdaysList("long");
		},
		overnight(): boolean {
			return parseTime(this.draft.end || "") <= parseTime(this.draft.start || "");
		},
		rangeInvalid(): boolean {
			if (this.draft.repeat || !this.fromLocal || !this.toLocal) return false;
			return new Date(this.toLocal).getTime() <= new Date(this.fromLocal).getTime();
		},
		valid(): boolean {
			if (this.draft.repeat) {
				return (
					(this.draft.weekdays || []).length > 0 && !!this.draft.start && !!this.draft.end
				);
			}
			return !!this.fromLocal && !!this.toLocal && !this.rangeInvalid;
		},
		summary(): string {
			const a = this.absence;
			const parts: string[] = [];
			if (a.repeat) {
				const overnight = parseTime(a.end || "") <= parseTime(a.start || "");
				parts.push(this.fmtWeekdaysRange(a.weekdays || []));
				parts.push(
					`${this.fmtTimeStr(a.start || "")} – ${this.fmtTimeStr(a.end || "")}${overnight ? " (+1)" : ""}`
				);
			} else {
				parts.push(`${this.fmtShortDateTime(a.from)} – ${this.fmtShortDateTime(a.to)}`);
			}
			if (a.energy) {
				parts.push(this.fmtKWh(a.energy));
			}
			return parts.join(" · ");
		},
	},
	watch: {
		expanded(value: boolean) {
			if (value) this.reset();
		},
		absence: {
			deep: true,
			handler() {
				if (!this.expanded) this.reset();
			},
		},
	},
	created() {
		this.reset();
	},
	methods: {
		formId(name: string): string {
			return `${this.formIdPrefix}-${this.absence.id}-${name}`;
		},
		occasionLabel(occasion: AbsenceOccasion): string {
			return this.$t(`main.chargingPlan.absences.occasions.${occasion}`);
		},
		fmtShortDateTime(value?: string): string {
			if (!value) return "–";
			const d = new Date(value);
			if (isNaN(d.getTime())) return "–";
			return new Intl.DateTimeFormat(this.$i18n?.locale, {
				weekday: "short",
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			}).format(d);
		},
		reset(): void {
			this.draft = deepClone(this.absence) as Absence;
			if (!this.draft.weekdays) this.draft.weekdays = [1, 2, 3, 4, 5];
			if (!this.draft.start) this.draft.start = "07:30";
			if (!this.draft.end) this.draft.end = "17:00";
			const tomorrow = floorQuarter(new Date(Date.now() + DAY_MS));
			this.fromLocal = rfcToLocalInput(this.draft.from, tomorrow);
			this.toLocal = rfcToLocalInput(this.draft.to, new Date(tomorrow.getTime() + DAY_MS));
		},
		toggleActive(e: Event): void {
			const active = (e.target as HTMLInputElement).checked;
			this.$emit("updated", normalizeAbsence({ ...this.absence, active }), false);
		},
		save(): void {
			if (!this.valid) return;
			const a: Absence = { ...this.draft };
			if (a.repeat) {
				a.start = roundTime(a.start);
				a.end = roundTime(a.end);
			} else {
				a.from = localInputToRFC3339(this.fromLocal);
				a.to = localInputToRFC3339(this.toLocal);
			}
			a.energy = Math.max(0, Number(a.energy) || 0);
			this.$emit("updated", normalizeAbsence(a));
		},
	},
});
</script>

<style scoped>
.absence + .absence {
	border-top: 1px solid var(--evcc-gray-25);
}
.min-w-0 {
	min-width: 0;
}
.occasions {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0.5rem;
}
@media (min-width: 768px) {
	.occasions {
		grid-template-columns: repeat(8, minmax(0, 1fr));
	}
}
.occasion {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
	padding: 0.5rem 0.25rem;
	border: 2px solid transparent;
	border-radius: 0.5rem;
	color: var(--evcc-gray);
	font-size: 0.75rem;
	max-width: 100%;
}
.occasion.active {
	border-color: var(--evcc-default-text);
	color: var(--evcc-default-text);
}
.repeat-group {
	max-width: 100%;
}
.repeat-group :deep(.btn) {
	flex: 0 0 auto;
	overflow: visible;
	text-overflow: clip;
}
.energy {
	max-width: 12rem;
}
</style>
