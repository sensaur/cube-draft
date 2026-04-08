import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

export const CountryBarChart = memo(function CountryBarChart({ data, palette: c, styles: s }: Props) {
  return (
    <div style={s.panel}>
      <div style={s.sectionTitle}>Revenue by Country</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={s.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
          />
          <YAxis dataKey="name" type="category" tick={s.tick} axisLine={false} tickLine={false} width={36} />
          <Tooltip {...s.tooltip} formatter={(value) => fmt$(Number(value))} />
          <Bar dataKey="value" name="Revenue" fill={ACCENT.countryBar} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
