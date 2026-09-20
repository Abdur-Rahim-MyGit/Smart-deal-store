import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { formatCompactPrice, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Dashboard charts.
 *
 * Every chart here plots a single series, so colour carries magnitude rather than
 * identity: one validated hue (blue, stepped per mode), hairline grid, thin marks
 * and a table view twin so no value is reachable only by hovering.
 */

// Validated against both card surfaces (light #ffffff, dark #232831).
const SERIES_LIGHT = "#2a78d6";
const SERIES_DARK = "#3987e5";

function useChartColors() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return {
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    grid: dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,11,0.08)",
    axis: "#898781",
  };
}

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-AE", { day: "numeric", month: "short" });

interface TooltipEntry {
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueKey,
  valueLabel,
  currency,
}: {
  active?: boolean | undefined;
  payload?: TooltipEntry[] | undefined;
  label?: string | undefined;
  valueKey: string;
  valueLabel: string;
  currency: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  const value = Number(row[valueKey] ?? 0);
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold">{label ? formatDay(label) : ""}</p>
      <p className="mt-0.5 text-muted-foreground">
        {valueLabel}:{" "}
        <span className="font-bold text-foreground tabular-nums">
          {currency ? formatPrice(value) : value}
        </span>
      </p>
    </div>
  );
}

/** Chart with a built-in table view so every value is readable without hovering. */
export function ChartCard({
  title,
  description,
  total,
  children,
  table,
  className,
}: {
  title: string;
  description?: string;
  total?: ReactNode;
  children: ReactNode;
  table: ReactNode;
  className?: string | undefined;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5", className)}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          {total !== undefined && (
            <p className="mt-2 font-display text-2xl font-extrabold">{total}</p>
          )}
        </div>
        <div
          className="flex rounded-xl border border-border p-0.5"
          role="group"
          aria-label={`${title} view`}
        >
          {(["chart", "table"] as const).map((option) => {
            const Icon = option === "chart" ? BarChart3 : Table2;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                  view === option
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {option}
              </button>
            );
          })}
        </div>
      </header>
      {view === "chart" ? children : <div className="max-h-[280px] overflow-y-auto">{table}</div>}
    </section>
  );
}

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

/** Revenue over time — single series area chart. */
export function RevenueAreaChart({ data }: { data: DailyPoint[] }) {
  const colors = useChartColors();
  if (!data.some((point) => point.revenue > 0))
    return <EmptyChart message="No revenue in this period yet." />;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.series} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors.series} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactPrice(value)}
            width={64}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1 }}
            content={<ChartTooltip valueKey="revenue" valueLabel="Revenue" currency />}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={colors.series}
            strokeWidth={2}
            fill="url(#revenueFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Orders per day — single series column chart. */
/** Daily counts as bars — orders by default, or any other count via valueLabel. */
export function OrdersBarChart({
  data,
  valueLabel = "Orders",
  emptyMessage = "No orders in this period yet.",
}: {
  data: DailyPoint[];
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const colors = useChartColors();
  if (!data.some((point) => point.orders > 0)) return <EmptyChart message={emptyMessage} />;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          barCategoryGap="20%"
        >
          <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: colors.grid }}
            content={<ChartTooltip valueKey="orders" valueLabel={valueLabel} currency={false} />}
          />
          <Bar dataKey="orders" fill={colors.series} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface RankedRow {
  label: string;
  value: number;
}

/** Ranked comparison (top products, revenue by category, orders by status). */
export function RankedBarList({
  rows,
  currency = true,
  emptyMessage = "Nothing to show yet.",
}: {
  rows: RankedRow[];
  currency?: boolean;
  emptyMessage?: string;
}) {
  const colors = useChartColors();
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || max <= 0) return <EmptyChart message={emptyMessage} />;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {currency ? formatPrice(row.value) : row.value}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: colors.series,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Table twin for the daily charts. */
export function DailyTable({
  data,
  valueKey,
  valueLabel,
}: {
  data: DailyPoint[];
  valueKey: "revenue" | "orders";
  valueLabel: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="py-2 font-semibold">Date</th>
          <th className="py-2 text-right font-semibold">{valueLabel}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((point) => (
          <tr key={point.date}>
            <td className="py-1.5">{formatDay(point.date)}</td>
            <td className="py-1.5 text-right tabular-nums">
              {valueKey === "revenue" ? formatPrice(point.revenue) : point.orders}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Table twin for ranked lists. */
export function RankedTable({
  rows,
  currency = true,
  label,
}: {
  rows: RankedRow[];
  currency?: boolean;
  label: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="py-2 font-semibold">{label}</th>
          <th className="py-2 text-right font-semibold">Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="py-1.5">{row.label}</td>
            <td className="py-1.5 text-right tabular-nums">
              {currency ? formatPrice(row.value) : row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
