import { memo } from "react";
import {
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardStyles } from "./theme";
import { ACCENT, fmt$ } from "./theme";
import type { DashboardPalette } from "./theme";

interface DataPoint {
  month: string;
  revenue: number;
  orders: number;
}

interface Props {
  data: DataPoint[];
  palette: DashboardPalette;
  styles: DashboardStyles;
}

export const MonthlyRevenueChart = memo(function MonthlyRevenueChart({
  data,
  palette: c,
  styles: s,
}: Props) {
  return (
    <div style={s.panel}>
      <div style={s.sectionTitle}>Monthly Revenue and Orders</div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis dataKey="month" tick={s.tick} axisLine={{ stroke: c.grid }} tickLine={false} />
          <YAxis
            yAxisId="revenue"
            tick={s.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
          />
          <YAxis yAxisId="orders" orientation="right" tick={s.tick} axisLine={false} tickLine={false} />
          <Tooltip
            {...s.tooltip}
            formatter={(value, name) => (name === "revenue" ? fmt$(Number(value)) : value)}
          />
          <Legend wrapperStyle={{ fontSize: "0.75rem", color: c.muted }} />
          <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill={ACCENT.barFill} radius={[3, 3, 0, 0]} />
          <Line yAxisId="orders" dataKey="orders" name="Orders" stroke={ACCENT.lineStroke} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});
