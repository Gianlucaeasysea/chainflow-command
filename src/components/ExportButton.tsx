import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

type Column = { key: string; label: string };

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: Column[];
  filename: string;
}

function buildRows(data: Record<string, unknown>[], columns: Column[]) {
  return data.map(row =>
    Object.fromEntries(columns.map(col => [col.label, row[col.key] ?? ""]))
  );
}

function exportCsv(data: Record<string, unknown>[], columns: Column[], filename: string) {
  const rows = buildRows(data, columns);
  const header = columns.map(c => `"${c.label}"`).join(";");
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.label];
      const s = String(v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    }).join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportXlsx(data: Record<string, unknown>[], columns: Column[], filename: string) {
  const rows = buildRows(data, columns);
  const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.label) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export default function ExportButton({ data, columns, filename }: ExportButtonProps) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fname = `${filename}_${today}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Esporta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCsv(data, columns, fname)}>
          Esporta CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXlsx(data, columns, fname)}>
          Esporta Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
