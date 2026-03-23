import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  expectedColumns: string[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(";").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export default function CsvImportDialog({ open, onOpenChange, title, expectedColumns, onImport }: CsvImportDialogProps) {
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("Nessuna riga valida nel CSV"); return; }
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      await onImport(rows);
      toast.success(`${rows.length} righe importate`);
      onOpenChange(false);
      setPreview([]);
    } catch (err) {
      toast.error("Errore importazione: " + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Formato CSV con separatore <code className="font-mono bg-muted px-1 rounded">;</code> — Colonne attese: <span className="font-mono text-primary">{expectedColumns.join("; ")}</span>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground" />
          </div>
          {preview.length > 0 && (
            <div className="border border-border rounded-lg overflow-x-auto max-h-48">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {Object.keys(preview[0]).map(k => <th key={k} className="p-2 text-left font-mono text-muted-foreground">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-border">
                      {Object.values(r).map((v, j) => <td key={j} className="p-2 font-mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 text-xs text-muted-foreground">Anteprima prime 5 righe...</div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); setPreview([]); }}>Annulla</Button>
            <Button onClick={handleImport} disabled={!fileRef.current?.files?.length || importing} className="gap-2">
              <Upload className="h-4 w-4" /> {importing ? "Importazione..." : "Importa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
