import { mount, config } from "@vue/test-utils";
import { describe, expect, test } from "vite-plus/test";
import TimeSeriesDataTable from "./TimeSeriesDataTable.vue";
import { CURRENCY } from "@/types/evcc";
import {
  absenceDetails,
  batteryColors,
  batteryDetails,
  evopt,
  home,
  timestamps,
} from "./stories.fixture";

config.global.mocks["$i18n"] = { locale: "en" };
config.global.mocks["$t"] = (a: any) => a;

const props = (absences: boolean) => ({
  evopt: evopt([home]),
  mode: "response" as const,
  batteryDetails: absences ? absenceDetails : batteryDetails,
  batteryColors,
  timestamps,
  currency: CURRENCY.EUR,
});

const labels = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll("tbody th").map((th) => th.text());

describe("TimeSeriesDataTable absences", () => {
  test("no away rows without availability data", () => {
    const wrapper = mount(TimeSeriesDataTable, { props: props(false) });
    expect(labels(wrapper).some((l) => l.includes("optimize.away"))).toBe(false);
  });

  test("away rows below the vehicle only", () => {
    const wrapper = mount(TimeSeriesDataTable, { props: props(true) });
    const l = labels(wrapper);
    const vehicle = l.indexOf("Garage (ID.3)");
    const battery = l.indexOf("Home Battery");
    const away = l.indexOf("↳ optimize.awayRow");
    const energy = l.findIndex((x) => x.startsWith("↳ optimize.awayEnergy"));
    expect(away).toBeGreaterThan(vehicle);
    expect(energy).toBe(away + 1);
    expect(battery).toBeGreaterThan(energy);
    expect(l.filter((x) => x === "↳ optimize.awayRow")).toHaveLength(1);

    const cells = wrapper.findAll("tbody tr")[away]!.findAll("td");
    // 07:30–10:30 and 16:00–18:00 are 12 + 8 quarter slots
    expect(cells.filter((c) => c.text() === "×")).toHaveLength(20);
  });
});
