import { mount, config } from "@vue/test-utils";
import { describe, expect, test } from "vite-plus/test";
import PlansAbsences from "./PlansAbsences.vue";
import type { Absence } from "@/types/evcc";

config.global.mocks["$i18n"] = { locale: "de-DE" };
config.global.mocks["$t"] = (a: any) => a;

const ABSENCES: Absence[] = [
  {
    id: "a",
    active: true,
    occasion: "work",
    repeat: true,
    weekdays: [1, 2, 3, 4, 5],
    start: "07:30",
    end: "17:00",
    tz: "Europe/Berlin",
    energy: 8,
  },
  {
    id: "b",
    active: true,
    occasion: "sport",
    repeat: true,
    weekdays: [3],
    start: "18:00",
    end: "20:00",
    tz: "Europe/Berlin",
    energy: 0,
  },
];

describe("PlansAbsences", () => {
  test("switching off emits the whole list with the entry inactive", async () => {
    const wrapper = mount(PlansAbsences, { props: { absences: ABSENCES } });
    const switches = wrapper.findAll('[data-testid="absence-active"]');
    expect(switches).toHaveLength(2);
    await switches[1]!.setValue(false);
    const emitted = wrapper.emitted("updated")?.[0]?.[0] as Absence[];
    expect(emitted.map((a) => [a.id, a.active])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  test("clicking a week block expands the entry, remove emits list without it", async () => {
    const wrapper = mount(PlansAbsences, { props: { absences: ABSENCES } });
    const blocks = wrapper.findAll('[data-testid="absence-week-block"]');
    expect(blocks).toHaveLength(6);
    const sport = blocks.find((b) => b.attributes("title")?.includes("sport"));
    await sport!.trigger("click");
    expect(wrapper.findAll('[data-testid="absence-form"]')).toHaveLength(1);
    await wrapper.find('[data-testid="absence-remove"]').trigger("click");
    const emitted = wrapper.emitted("updated")?.[0]?.[0] as Absence[];
    expect(emitted.map((a) => a.id)).toEqual(["a"]);
  });

  test("adding saves a new entry appended to the list", async () => {
    const wrapper = mount(PlansAbsences, { props: { absences: ABSENCES } });
    await wrapper.find('[data-testid="absence-add"]').trigger("click");
    await wrapper.find('[data-testid="absence-occasion-school"]').trigger("click");
    await wrapper.find('[data-testid="absence-form"]').trigger("submit");
    const emitted = wrapper.emitted("updated")?.[0]?.[0] as Absence[];
    expect(emitted).toHaveLength(3);
    expect(emitted[2]).toMatchObject({ occasion: "school", repeat: true, active: true });
  });

  test("shows hint when a repeating goal lies inside an absence", () => {
    const wrapper = mount(PlansAbsences, {
      props: {
        absences: ABSENCES,
        repeatingPlans: [
          { weekdays: [2], time: "12:00", tz: "Europe/Berlin", soc: 80, active: true },
        ],
      },
    });
    expect(wrapper.find('[data-testid="absence-goal-hint"]').exists()).toBe(true);
  });
});
