import { ref } from "vue";
import ChargeChart from "./ChargeChart.vue";
import SocChart from "./SocChart.vue";
import Card from "../Helper/Card.vue";
import type { Meta, StoryFn } from "@storybook/vue3";
import { horizonOf, isZoomed } from "./zoom";
import {
  batteryColors,
  batteryDetails,
  demandColors,
  evopt,
  heatPump,
  home,
} from "./stories.fixture";

interface Args {
  // visible window in hours after the horizon start (18:00)
  fromHour: number;
  toHour: number;
}

export default {
  title: "Optimize/ZoomedCharts",
  parameters: { layout: "padded" },
  args: { fromHour: 3, toHour: 9 },
} as Meta<Args>;

const socEntries = batteryDetails.map((d, index) => ({
  index,
  title: d.title || d.name,
  capacity: d.capacity || 0,
  color: batteryColors[index] || "",
}));

// the shared fixture reports SoC in percent, the SoC chart expects Wh
const data = evopt([home, heatPump]);
// starts in the evening, so the plan crosses midnight
const timestamp = new Date(2025, 5, 12, 18).toISOString();
data.res.batteries.forEach((b, i) => {
  b.state_of_charge = b.state_of_charge.map((pct) => pct * (socEntries[i]?.capacity || 0) * 10);
});

// both charts follow one range
export const Zoomed: StoryFn<Args> = (args) => ({
  components: { ChargeChart, SocChart, Card },
  setup() {
    const horizon = horizonOf(timestamp, data.req.time_series.dt);
    const hour = 3600 * 1000;
    return {
      horizon,
      // toHour <= fromHour shows the full horizon
      range: ref(
        args.toHour > args.fromHour
          ? {
              start: horizon.start + args.fromHour * hour,
              end: horizon.start + args.toHour * hour,
            }
          : { ...horizon }
      ),
      isZoomed,
      evopt: data,
      batteryDetails,
      batteryColors,
      demandColors,
      demandDetails: [home, heatPump],
      socEntries,
      timestamp,
    };
  },
  template: `<div class="container px-0">
    <Card title="Charging Plan" subtitle="kW" edge-to-edge class="box-pull-out mb-4">
      <template v-if="isZoomed(range, horizon)" #actions><button type="button" class="btn btn-sm btn-link p-0" @click="range = { ...horizon }">Reset zoom</button></template>
      <ChargeChart :range="range" :horizon="horizon" @update:range="range = $event" :evopt="evopt" :battery-details="batteryDetails" :demand-details="demandDetails" :demand-colors="demandColors" :battery-colors="batteryColors" :timestamp="timestamp" />
    </Card>
    <Card title="SoC Projections" subtitle="%" edge-to-edge class="box-pull-out">
      <template v-if="isZoomed(range, horizon)" #actions><button type="button" class="btn btn-sm btn-link p-0" @click="range = { ...horizon }">Reset zoom</button></template>
      <SocChart v-for="(entry, i) in socEntries" :key="entry.index" :range="range" :horizon="horizon" @update:range="range = $event" :evopt="evopt" :entry="entry" :timestamp="timestamp" :show-x-axis="i === socEntries.length - 1" />
    </Card>
  </div>`,
});
