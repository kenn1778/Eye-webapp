import type { ActivityPoint } from "../../types";

type SeriesKey = "subscribers" | "chat" | "reviews";

type AdminActivityChartProps = {
  series: ActivityPoint[];
};

// Fixed coordinate system; CSS scales the SVG to its container.
const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 18, right: 14, bottom: 30, left: 38 };

const SERIES: ReadonlyArray<{ key: SeriesKey; label: string; color: string }> = [
  { key: "chat", label: "Chat messages", color: "#5f8a63" },
  { key: "subscribers", label: "Subscribers", color: "#d45b3c" },
  { key: "reviews", label: "Reviews", color: "#5f779d" },
];

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AdminActivityChart({ series }: AdminActivityChartProps) {
  if (series.length === 0) {
    return (
      <p className="chart-empty">
        No activity yet. New subscribers, messages, and reviews will appear here.
      </p>
    );
  }

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const baseline = PAD.top + innerH;
  const max = Math.max(1, ...series.flatMap((point) => [point.subscribers, point.chat, point.reviews]));
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

  const x = (index: number) => PAD.left + index * stepX;
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;

  const linePath = (key: SeriesKey) =>
    series
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point[key]).toFixed(1)}`)
      .join(" ");

  const areaPath = (key: SeriesKey) =>
    `${linePath(key)} L ${x(series.length - 1).toFixed(1)} ${baseline.toFixed(1)} L ${x(0).toFixed(1)} ${baseline.toFixed(1)} Z`;

  const gridValues = [0, max / 2, max];
  const labelIndexes =
    series.length > 1 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : [0];

  return (
    <div className="activity-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Daily activity for subscribers, chat messages, and reviews"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {SERIES.map((entry) => (
            <linearGradient key={entry.key} id={`chart-grad-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={entry.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridValues.map((value) => (
          <g key={value}>
            <line x1={PAD.left} y1={y(value)} x2={WIDTH - PAD.right} y2={y(value)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(value) + 3} className="chart-axis" textAnchor="end">
              {Math.round(value)}
            </text>
          </g>
        ))}

        {SERIES.map((entry) => (
          <path key={`area-${entry.key}`} d={areaPath(entry.key)} fill={`url(#chart-grad-${entry.key})`} />
        ))}

        {SERIES.map((entry) => (
          <path
            key={`line-${entry.key}`}
            d={linePath(entry.key)}
            fill="none"
            stroke={entry.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {series.map((point, index) => (
          <g key={point.date}>
            {SERIES.map((entry) => (
              <circle key={entry.key} cx={x(index)} cy={y(point[entry.key])} r="2.4" fill={entry.color} />
            ))}
          </g>
        ))}

        {labelIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={HEIGHT - 8}
            className="chart-axis"
            textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
          >
            {formatDay(series[index].date)}
          </text>
        ))}
      </svg>

      <div className="chart-legend">
        {SERIES.map((entry) => (
          <span key={entry.key} className="chart-legend-item">
            <span className="chart-swatch" style={{ background: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
