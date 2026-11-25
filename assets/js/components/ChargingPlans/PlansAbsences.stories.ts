import PlansAbsences from "./PlansAbsences.vue";
import type { Meta, StoryFn } from "@storybook/vue3";
import type { Absence } from "@/types/evcc";

const inDays = (days: number, hours: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

const absences: Absence[] = [
  {
    id: "work",
    active: true,
    occasion: "work",
    repeat: true,
    weekdays: [1, 2, 3, 4, 5],
    start: "07:30",
    end: "17:15",
    tz: "Europe/Berlin",
    energy: 8,
  },
  {
    id: "sport",
    active: true,
    occasion: "sport",
    repeat: true,
    weekdays: [3],
    start: "19:00",
    end: "21:30",
    tz: "Europe/Berlin",
  },
  {
    id: "visit",
    active: true,
    occasion: "visit",
    repeat: false,
    from: inDays(2, 18),
    to: inDays(4, 12),
    tz: "Europe/Berlin",
    energy: 35,
  },
  {
    id: "school",
    active: false,
    occasion: "school",
    repeat: true,
    weekdays: [6],
    start: "09:00",
    end: "12:00",
    tz: "Europe/Berlin",
  },
] as Absence[];

export default {
  title: "ChargingPlans/PlansAbsences",
  component: PlansAbsences,
  parameters: { layout: "padded" },
} as Meta<typeof PlansAbsences>;

const Template: StoryFn<typeof PlansAbsences> = (args) => ({
  components: { PlansAbsences },
  setup() {
    return { args };
  },
  template: '<div style="max-width: 900px"><PlansAbsences v-bind="args" /></div>',
});

export const Default = Template.bind({});
Default.args = {
  id: 1,
  absences,
  repeatingPlans: [
    { weekdays: [1, 2, 3, 4, 5], time: "09:00", tz: "Europe/Berlin", soc: 80, active: true },
  ],
};

export const Empty = Template.bind({});
Empty.args = { id: 1, absences: [] };
