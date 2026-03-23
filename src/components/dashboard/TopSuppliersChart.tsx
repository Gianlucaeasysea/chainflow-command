import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "MetalTech Srl", spend: 125000 },
  { name: "TechSupply SpA", spend: 98000 },
  { name: "FastParts GmbH", spend: 87000 },
  { name: "ComponentiItalia", spend: 72000 },
  { name: "AlloyWorks Ltd", spend: 64000 },
];

export function TopSuppliersChart() {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Fornitori per Spesa</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis
              type="number"
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
              tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: "hsl(214 33% 91%)", fontSize: 11 }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(213 40% 14%)",
                border: "1px solid hsl(213 25% 22%)",
                borderRadius: "6px",
                color: "hsl(214 33% 91%)",
                fontFamily: "DM Mono",
                fontSize: 12,
              }}
              formatter={(value: number) => [`€${value.toLocaleString()}`, "Spesa"]}
            />
            <Bar dataKey="spend" fill="hsl(36 90% 55%)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
