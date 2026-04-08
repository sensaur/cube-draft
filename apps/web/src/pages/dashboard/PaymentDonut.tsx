import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

export const PaymentDonut = memo(function PaymentDonut({ data, palette: c, styles: s }: Props) {
  return (
    <div style={s.panel}>
      <div style={s.sectionTitle}>Payment Methods Analysis</div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={ACCENT.pie[i % ACCENT.pie.length]} />
            ))}
          </Pie>
          <Tooltip {...s.tooltip} formatter={(value) => fmt$(Number(value))} />
          <Legend wrapperStyle={{ fontSize: "0.75rem", color: c.muted }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
