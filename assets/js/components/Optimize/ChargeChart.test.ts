import { mount, config } from "@vue/test-utils";
import { describe, expect, test } from "vite-plus/test";
import ChargeChart from "./ChargeChart.vue";
import { horizonOf } from "./zoom";
import {
  absenceDetails,
  batteryColors,
  batteryDetails,
  demandColors,
  evopt,
  home,
  timestamps,
} from "./stories.fixture";

config.global.mocks["$i18n"] = { locale: "en" };
config.global.mocks["$t"] = (a: any) => a;

const data = evopt([home]);
const horizon = horizonOf(timestamps[0]!, data.req.time_series.dt);

const props = (absences: boolean) => ({
  evopt: data,
  range: horizon,
  horizon,
  batteryDetails: absences ? absenceDetails : batteryDetails,
  batteryColors,
  demandColors,
  demandDetails: [home],
  timestamp: timestamps[0],
});

// away bands as markArea series on the time axis
const bands = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.vm as any).chartOption.series.filter((s: any) => s.markArea);

describe("ChargeChart absences", () => {
  test("no bands without availability data", () => {
    const wrapper = mount(ChargeChart, {
      props: props(false),
      global: { stubs: { LegendList: true } },
    });
    expect(bands(wrapper)).toHaveLength(0);
    expect((wrapper.vm as any).legends.some((l: any) => l.type === "hatched")).toBe(false);
  });

  test("bands at slot times, legend and tooltip row", () => {
    const wrapper = mount(ChargeChart, {
      props: props(true),
      global: { stubs: { LegendList: true } },
    });
    const [band] = bands(wrapper);
    expect(bands(wrapper)).toHaveLength(1);

    const t0 = new Date(timestamps[0]!).getTime();
    const data = band.markArea.data;
    // 07:30–10:30 and 16:00–18:00, slots start at 06:00
    expect(data).toEqual([
      [{ xAxis: t0 + 1.5 * 3600e3 }, { xAxis: t0 + 4.5 * 3600e3 }],
      [{ xAxis: t0 + 10 * 3600e3 }, { xAxis: t0 + 12 * 3600e3 }],
    ]);

    const legends = (wrapper.vm as any).legends;
    expect(legends.at(-1)).toMatchObject({ label: "optimize.awayLegend", type: "hatched" });

    const vm = wrapper.vm as any;
    const html = (index: number) =>
      vm.tooltipFormatter([{ dataIndex: index, seriesName: "x", value: [0, 1] }]);
    expect(html(6)).toContain("Garage (ID.3)"); // 07:30
    expect(html(6)).toContain("optimize.away");
    expect(html(2)).not.toContain("optimize.away");
  });
});
