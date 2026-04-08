import { memo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardStyles, DashboardPalette } from "./theme";
import { ACCENT, fmt$ } from "./theme";

interface DataPoint {
  name: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  palette: DashboardPalette;
  styles: DashboardStyles;
}

export const CategoryBarChart = memo(function CategoryBarChart({ data, palette: c, styles: s }: Props) {
  return (
    <div style={s.panel}>
      <div style={s.sectionTitle}>Top Product Categories</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={s.tickSm}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={s.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip {...s.tooltip} formatter={(value) => fmt$(Number(value))} />
          <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={ACCENT.category[i % ACCENT.category.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
