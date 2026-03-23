import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Gen", value: 42000 },
  { month: "Feb", value: 38000 },
  { month: "Mar", value: 55000 },
  { month: "Apr", value: 47000 },
  { month: "Mag", value: 62000 },
  { month: "Giu", value: 51000 },
  { month: "Lug", value: 44000 },
  { month: "Ago", value: 28000 },
  { month: "Set", value: 58000 },
  { month: "Ott", value: 63000 },
  { month: "Nov", value: 71000 },
  { month: "Dic", value: 49000 },
];

export function PurchaseChart() {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Acquisti Ultimi 12 Mesi</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213 25% 22%)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
            />
            <YAxis
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
              tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
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
              formatter={(value: number) => [`€${value.toLocaleString()}`, "Totale"]}
            />
            <Bar dataKey="value" fill="hsl(36 90% 55%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
