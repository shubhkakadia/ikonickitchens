// Chart.js setup shared by every dashboard chart. Registering once here keeps
// each panel from re-registering, and lets the Insights bundle (the only
// importer) carry Chart.js instead of the dashboard's first load.

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { CHART_COLORS } from "./format";

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

// Bar marks per DESIGN.md 5.6: 4px rounded data-end anchored to the baseline.
export const barDataset = (label, data, color, extra = {}) => ({
  label,
  data,
  backgroundColor: color,
  borderRadius: 4,
  borderSkipped: "bottom",
  maxBarThickness: 18,
  ...extra,
});

/**
 * Shared options for a vertical bar chart on one y-axis.
 * - format:  value -> tooltip text
 * - tick:    value -> y-axis tick text (defaults to format)
 * - legend:  show the legend (only for two or more series)
 * - stacked: stack the datasets
 */
export const barOptions = ({
  format = (v) => String(v),
  tick,
  legend = true,
  stacked = false,
  titles,
} = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      display: legend,
      position: "bottom",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
        font: { size: 11 },
        color: CHART_COLORS.legend,
      },
    },
    tooltip: {
      backgroundColor: CHART_COLORS.tooltip,
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      callbacks: {
        ...(titles && { title: (items) => titles[items[0]?.dataIndex] ?? "" }),
        label: (ctx) => {
          const value = ctx.parsed.y ?? 0;
          return legend
            ? `${ctx.dataset.label}: ${format(value)}`
            : format(value);
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked,
      border: { display: false },
      grid: { color: CHART_COLORS.grid },
      ticks: {
        font: { size: 10 },
        color: CHART_COLORS.tick,
        precision: 0,
        callback: (value) => (tick ?? format)(value),
      },
    },
    x: {
      stacked,
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 10 }, color: CHART_COLORS.tick },
    },
  },
});
