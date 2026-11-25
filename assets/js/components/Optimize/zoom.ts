import { defineComponent, type PropType } from "vue";
import echartsChart from "@/mixins/echartsChart";
import colors, { setAlpha } from "@/colors";

// a span of the plan in epoch ms, the visible window shared by the charging plan and SoC charts
export interface ZoomRange {
  start: number;
  end: number;
}

// echarts rounds while zooming, a minute is noise
const EPSILON_MS = 60 * 1000;

// the plan's whole time span
export function horizonOf(timestamp: string, dt: number[]): ZoomRange {
  const start = new Date(timestamp).getTime();
  return { start, end: start + dt.reduce((sum, s) => sum + s, 0) * 1000 };
}

// a window stays at its clock time when the horizon moves with a new plan, cut to what is
// left of it; the whole horizon when nothing is
export function clampRange(range: ZoomRange | null, horizon: ZoomRange): ZoomRange {
  if (!range) return horizon;
  const start = Math.max(range.start, horizon.start);
  const end = Math.min(range.end, horizon.end);
  return start < end ? { start, end } : horizon;
}

export function isZoomed(range: ZoomRange, horizon: ZoomRange): boolean {
  return range.start > horizon.start + EPSILON_MS || range.end < horizon.end - EPSILON_MS;
}

// the range a `dataZoom` event reports (as percent of the horizon), null when it is the one
// we already show
export function rangeFromEvent(
  event: { start?: number; end?: number; batch?: { start?: number; end?: number }[] },
  horizon: ZoomRange,
  current: ZoomRange
): ZoomRange | null {
  const { start, end } = event.batch?.[0] ?? event;
  if (start === undefined || end === undefined) return null;
  const span = horizon.end - horizon.start;
  const range = {
    start: horizon.start + (start / 100) * span,
    end: horizon.start + (end / 100) * span,
  };
  if (
    Math.abs(range.start - current.start) < EPSILON_MS &&
    Math.abs(range.end - current.end) < EPSILON_MS
  ) {
    return null;
  }
  return range;
}

// x axis label step in hours: denser the further zoomed in
export function labelStepHours(range: ZoomRange, fullStep: number): number {
  const visibleHours = (range.end - range.start) / 3600000;
  if (visibleHours <= 8) return 1;
  if (visibleHours <= 16) return Math.min(2, fullStep);
  return fullStep;
}

// dataZoom window of a range, in percent of the horizon. With start/endValue the day divider
// axis ticks hourly instead of daily
function windowOf(range: ZoomRange, horizon: ZoomRange) {
  const span = horizon.end - horizon.start;
  return {
    start: ((range.start - horizon.start) / span) * 100,
    end: ((range.end - horizon.start) / span) * 100,
  };
}

// the slider is for mice: the touch tooltip gate keeps raw touches from the chart
export function hasMouse(): boolean {
  return !window.matchMedia?.("(pointer: coarse)").matches;
}

// mouse: ctrl + wheel (also a trackpad pinch) zooms, shift + wheel and dragging pan, the plain
// wheel keeps scrolling the page. Touch never reaches the chart, see hasMouse.
export function insideZoom(
  range: ZoomRange,
  horizon: ZoomRange,
  xAxisIndex: number[],
  filterMode = "none"
) {
  return {
    type: "inside",
    xAxisIndex,
    ...windowOf(range, horizon),
    filterMode,
    zoomOnMouseWheel: "ctrl",
    moveOnMouseWheel: "shift",
    moveOnMouseMove: true,
  };
}

// compact scrollbar below the plot, without handle labels
export function sliderZoom(
  range: ZoomRange,
  horizon: ZoomRange,
  xAxisIndex: number[],
  filterMode = "none"
) {
  return {
    type: "slider",
    xAxisIndex,
    ...windowOf(range, horizon),
    filterMode,
    height: 14,
    bottom: 4,
    left: 0,
    right: 36,
    showDetail: false,
    showDataShadow: false,
    brushSelect: false,
    borderColor: "transparent",
    backgroundColor: colors.border || "",
    fillerColor: setAlpha(colors.muted, "40"),
    handleSize: "100%",
    handleStyle: { color: colors.muted || "", borderColor: "transparent" },
    moveHandleSize: 0,
    emphasis: { handleStyle: { color: colors.text || "" } },
  };
}

// keeps the charts' zoom in the `range` model: user zooms are reported as `update:range`,
// the shared range is applied by the chart's own `dataZoom` options
export default defineComponent({
  mixins: [echartsChart],
  props: {
    range: { type: Object as PropType<ZoomRange>, required: true },
    horizon: { type: Object as PropType<ZoomRange>, required: true },
  },
  emits: ["update:range"],
  methods: {
    onChartInit() {
      const chart = this.chart;
      if (!chart) return;
      chart.on("dataZoom", (event) => {
        const range = rangeFromEvent(
          event as Parameters<typeof rangeFromEvent>[0],
          this.horizon,
          this.range
        );
        if (range) this.$emit("update:range", range);
      });
      chart.getZr().on("dblclick", () => this.$emit("update:range", this.horizon));
    },
  },
});
