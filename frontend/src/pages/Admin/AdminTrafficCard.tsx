import type { AdminTraffic } from "../../lib/adminApi";

type AdminTrafficCardProps = {
  traffic: AdminTraffic | null;
};

// Fixed coordinate system; CSS scales the SVG to its container.
const WIDTH = 720;
const HEIGHT = 190;
const PAD = { top: 16, right: 14, bottom: 28, left: 38 };

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stat(value: number, digits = 0): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// Lightweight sparkline for the GA4 window: page views + visitors lines with
// the same visual language as AdminActivityChart (single-colour palette here
// so the two charts read as different data domains).
function TrafficChart({ series }: { series: AdminTraffic["series"] }) {
  if (series.length === 0) {
    return <p className="chart-empty">No traffic recorded in this window yet.</p>;
  }
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(1, ...series.flatMap((point) => [point.users, point.views]));
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

  const points = (pick: (p: AdminTraffic["series"][number]) => number) =>
    series
      .map((point, index) => {
        const x = PAD.left + index * stepX;
        const y = PAD.top + innerH - (pick(point) / max) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  // Thin out date labels on narrow data sets - roughly every other tick.
  const labels = series
    .filter((_, index) => series.length <= 8 || index % 2 === 0)
    .map((point, index) => ({
      date: point.date,
      x: PAD.left + (series.length > 1 ? (index * 2 * stepX) : 0),
    }));

  return (
    <div className="activity-chart" role="img" aria-label="Site visitors and page views over the last window">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ height: "auto" }}>
      <polyline points={points((p) => p.views)} fill="none" stroke="#c9702c" strokeWidth="2.5" />
      <polyline points={points((p) => p.users)} fill="none" stroke="#5f779d" strokeWidth="2.5" />
      {labels.map((label) => (
        <text
          key={label.date}
          className="chart-axis"
          x={label.x}
          y={HEIGHT - 6}
          textAnchor="middle"
        >
          {formatDay(label.date)}
        </text>
      ))}
      </svg>
    </div>
  );
}

export function AdminTrafficCard({ traffic }: AdminTrafficCardProps) {
  if (!traffic) {
    return (
      <p className="chart-empty">
        Not reporting yet - connect the GA4 property (measurement id + service account) and this
        card fills with real visitor and page-view counts.
      </p>
    );
  }

  return (
    <div>
      <div className="insight-grid" style={{ marginTop: 10 }}>
        <div className="insight-tile">
          <span className="insight-label">Visitors</span>
          <strong>{stat(traffic.totals.visitors)}</strong>
          <span className="insight-delta">
            {traffic.totals.visitors > 0
              ? `${stat((traffic.totals.newVisitors / traffic.totals.visitors) * 100, 0)}% new`
              : "No visitors yet"}
          </span>
        </div>
        <div className="insight-tile">
          <span className="insight-label">Page views</span>
          <strong>{stat(traffic.totals.pageViews)}</strong>
          <span className="insight-delta">
            {traffic.totals.sessions > 0
              ? `${stat(traffic.totals.pageViews / traffic.totals.sessions, 1)} per session`
              : "No sessions yet"}
          </span>
        </div>
        <div className="insight-tile">
          <span className="insight-label">Top page</span>
          <strong className="insight-name" aria-label={traffic.topPages[0]?.path ?? ""}>
            {traffic.topPages[0]?.path ?? "\u2014"}
          </strong>
          <span className="insight-delta">
            {traffic.topPages[0] ? `${stat(traffic.topPages[0].views)} views` : "No pages yet"}
          </span>
        </div>
        <div className="insight-tile">
          <span className="insight-label">Top source</span>
          <strong className="insight-name">{traffic.sources[0]?.source ?? "Direct"}</strong>
          <span className="insight-delta">
            {traffic.sources[0] ? `${stat(traffic.sources[0].users)} visitors` : "No channels yet"}
          </span>
        </div>
      </div>
      <TrafficChart series={traffic.series} />
      <div className="insight-grid" style={{ marginTop: 6 }}>
        <div className="insight-tile" style={{ gridColumn: "1 / -1" }}>
          <span className="insight-label">Most-read pages</span>
          {traffic.topPages.length === 0 ? (
            <span className="insight-delta">Nothing ranked yet.</span>
          ) : (
            <ul className="ga-list">
              {traffic.topPages.slice(0, 5).map((page) => (
                <li key={page.path}>
                  <span>{page.path}</span>
                  <strong>{stat(page.views)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
