/**
 * Reusable Excel/CSV Import Engine
 * 
 * 5-layer architecture:
 *   Layer 1 – File parsing (raw cell extraction)
 *   Layer 2 – Cleaning (normalize, strip, deduplicate)
 *   Layer 3 – Validation (check format, lookup existence)
 *   Layer 4 – Preview (structured result for UI)
 *   Layer 5 – Confirmed import (execute after user approval)
 */

import ExcelJS from "exceljs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TickerStatus = "valid" | "unknown" | "invalid" | "duplicate";

export interface ImportedTicker {
  raw: string;
  cleaned: string;
  status: TickerStatus;
  remark: string;
}

export interface ImportResult {
  fileName: string;
  totalRows: number;
  tickers: ImportedTicker[];
  errors: string[];
  timestamp: string;
}

// ─── Layer 1: File Parsing ───────────────────────────────────────────────────

/** Extract a string value from any ExcelJS cell, handling formulas, rich text, errors */
function getCellString(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell) return "";
  try {
    const v = (cell as any).result ?? cell.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      // Rich text
      if ("richText" in v && Array.isArray((v as any).richText)) {
        return (v as any).richText.map((rt: any) => rt.text ?? "").join("");
      }
      // Error object
      if ("error" in v) return "";
      // Hyperlink
      if ("text" in v) return String((v as any).text ?? "");
      // Formula with result
      if ("result" in v) {
        const r = (v as any).result;
        return r === null || r === undefined ? "" : String(r);
      }
      // Date
      if (v instanceof Date) return "";
    }
    return String(v);
  } catch {
    return "";
  }
}

/** Parse an Excel or CSV file into raw string rows (first usable column per row) */
async function parseFile(file: File): Promise<{ rows: string[][]; errors: string[] }> {
  const errors: string[] = [];
  const data = await file.arrayBuffer();
  
  // CSV handling
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(data);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) {
      errors.push("Bestand bevat alleen lege rijen.");
      return { rows: [], errors };
    }
    // Detect delimiter
    const firstLine = lines[0];
    const delimiters = [",", ";", "\t"];
    const delimiter = delimiters.reduce((best, d) =>
      (firstLine.split(d).length > firstLine.split(best).length) ? d : best
    , ",");
    const rows = lines.map((line) => line.split(delimiter).map((c) => c.trim()));
    return { rows, errors };
  }

  // Excel handling — try ExcelJS first, then raw text fallback
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      errors.push("Geen werkblad gevonden in het bestand.");
      return { rows: [], errors };
    }
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(getCellString(cell));
      });
      rows.push(cells);
    });
    return { rows, errors };
  } catch (excelError) {
    // ExcelJS failed — try reading as raw text (some .xlsx files are malformed)
    try {
      const text = new TextDecoder("utf-8").decode(data);
      // Check if it's actually text-based
      if (text.includes("\0") || text.startsWith("PK")) {
        // It's a binary file ExcelJS couldn't read
        errors.push(
          `Kon het Excel-bestand niet lezen. Probeer het bestand opnieuw op te slaan als .xlsx (via "Opslaan als" in Excel) of exporteer als .csv. Technische fout: ${excelError instanceof Error ? excelError.message : "onbekend"}`
        );
        return { rows: [], errors };
      }
      // Parse as text/csv
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        errors.push("Bestand bevat alleen lege rijen.");
        return { rows: [], errors };
      }
      const rows = lines.map((line) => line.split(/[,;\t]/).map((c) => c.trim()));
      return { rows, errors };
    } catch {
      errors.push(
        `Kon het bestand niet lezen. Probeer het op te slaan als .csv. Technische fout: ${excelError instanceof Error ? excelError.message : "onbekend"}`
      );
      return { rows: [], errors };
    }
  }
}

// ─── Layer 2: Cleaning ──────────────────────────────────────────────────────

const HEADER_PATTERNS = [
  "TICKER", "SYMBOL", "CODE", "NAAM", "NAME", "ISIN", "SECURITY",
  "STOCK", "AANDEEL", "FONDS", "FUND",
];

const TICKER_REGEX = /^[A-Z0-9][A-Z0-9.\-]{0,19}$/;

/** Clean and normalize a raw string into a potential ticker */
function cleanTickerValue(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    // Remove invisible/zero-width chars
    .replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, "")
    // Remove surrounding quotes
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

/** Detect the ticker column index and whether a header row is present */
function detectTickerColumn(rows: string[][]): { colIndex: number; hasHeader: boolean } {
  if (rows.length === 0) return { colIndex: 0, hasHeader: false };

  const firstRow = rows[0].map((c) => c.trim().toUpperCase());

  // Exact header match
  for (let i = 0; i < firstRow.length; i++) {
    if (/^(TICKER|SYMBOL|CODE|ISIN)$/.test(firstRow[i])) {
      return { colIndex: i, hasHeader: true };
    }
  }

  // Starts-with match
  for (let i = 0; i < firstRow.length; i++) {
    const normalised = firstRow[i].replace(/[_\\s]+/g, " ");
    if (/^(TICKER|SYMBOL|CODE|ISIN)/.test(normalised)) {
      return { colIndex: i, hasHeader: true };
    }
  }

  // Contains match
  for (let i = 0; i < firstRow.length; i++) {
    const normalised = firstRow[i].replace(/[_\\s]+/g, " ");
    if (/(TICKER|SYMBOL)/.test(normalised)) {
      return { colIndex: i, hasHeader: true };
    }
  }

  // No header detected — check first row to see if it IS a header (non-ticker text)
  const firstVal = cleanTickerValue(rows[0][0] ?? "");
  if (HEADER_PATTERNS.includes(firstVal)) {
    return { colIndex: 0, hasHeader: true };
  }

  // Default: first column, no header
  return { colIndex: 0, hasHeader: false };
}

/** Extract cleaned tickers from parsed rows */
function extractTickers(rows: string[][]): { tickers: string[]; rawMap: Map<string, string>; errors: string[] } {
  const errors: string[] = [];
  if (rows.length === 0) {
    errors.push("Bestand bevat alleen lege rijen.");
    return { tickers: [], rawMap: new Map(), errors };
  }

  const { colIndex, hasHeader } = detectTickerColumn(rows);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) {
    errors.push("Bestand bevat alleen een headerrij en geen data.");
    return { tickers: [], rawMap: new Map(), errors };
  }

  const tickers: string[] = [];
  const rawMap = new Map<string, string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = hasHeader ? i + 2 : i + 1;

    // Try primary column
    let raw = row[colIndex] ?? "";
    let cleaned = cleanTickerValue(raw);

    // If primary column empty/invalid, scan other columns
    if (!cleaned || !TICKER_REGEX.test(cleaned) || cleaned.includes("#")) {
      let found = false;
      for (let ci = 0; ci < row.length; ci++) {
        if (ci === colIndex) continue;
        const alt = cleanTickerValue(row[ci]);
        if (alt && TICKER_REGEX.test(alt) && !alt.includes("#") && !HEADER_PATTERNS.includes(alt)) {
          cleaned = alt;
          raw = row[ci];
          found = true;
          break;
        }
      }
      if (!found) {
        // Skip truly empty rows silently
        if (row.every((c) => !c.trim())) continue;
        errors.push(`Rij ${rowNum}: geen geldige ticker gevonden (waarde: "${raw.trim() || "(leeg)"}")`);
        continue;
      }
    }

    // Strip exchange suffix for normalisation but keep original
    rawMap.set(cleaned, raw.trim());
    tickers.push(cleaned);
  }

  return { tickers, rawMap, errors };
}

// ─── Layer 3: Validation ────────────────────────────────────────────────────

/** Validate tickers against known securities in the database */
export async function validateTickers(
  tickers: string[],
  lookupFn: (tickers: string[]) => Promise<Set<string>>
): Promise<ImportedTicker[]> {
  const seen = new Set<string>();
  const knownTickers = await lookupFn(tickers);
  const result: ImportedTicker[] = [];

  for (const ticker of tickers) {
    if (seen.has(ticker)) {
      result.push({ raw: ticker, cleaned: ticker, status: "duplicate", remark: "Dubbel in bestand" });
      continue;
    }
    seen.add(ticker);

    if (!TICKER_REGEX.test(ticker)) {
      result.push({ raw: ticker, cleaned: ticker, status: "invalid", remark: "Ongeldig formaat" });
      continue;
    }

    // Also try without exchange suffix
    const baseTicker = ticker.replace(/\.[A-Z]{1,4}$/, "");
    if (knownTickers.has(ticker) || knownTickers.has(baseTicker)) {
      result.push({ raw: ticker, cleaned: ticker, status: "valid", remark: "Gevonden in database" });
    } else {
      result.push({ raw: ticker, cleaned: ticker, status: "unknown", remark: "Nieuw — wordt aangemaakt" });
    }
  }

  return result;
}

// ─── Layer 4: Preview (full pipeline) ───────────────────────────────────────

export async function generateImportPreview(
  file: File,
  lookupFn: (tickers: string[]) => Promise<Set<string>>
): Promise<ImportResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  // Layer 1: Parse
  const { rows, errors: parseErrors } = await parseFile(file);
  errors.push(...parseErrors);

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Bestand bevat geen data.");
  }

  if (rows.length === 0) {
    return { fileName: file.name, totalRows: 0, tickers: [], errors, timestamp };
  }

  // Layer 2: Clean & extract
  const { tickers, rawMap, errors: extractErrors } = extractTickers(rows);
  errors.push(...extractErrors);

  if (tickers.length === 0) {
    if (errors.length === 0) {
      errors.push("Geen geldige tickers gedetecteerd in het bestand.");
    }
    return { fileName: file.name, totalRows: rows.length, tickers: [], errors, timestamp };
  }

  // Layer 3: Validate
  const validated = await validateTickers(tickers, lookupFn);

  // Attach raw values
  for (const item of validated) {
    const raw = rawMap.get(item.cleaned);
    if (raw) item.raw = raw;
  }

  return {
    fileName: file.name,
    totalRows: rows.length,
    tickers: validated,
    errors,
    timestamp,
  };
}

// ─── Layer 5: Confirmed import ──────────────────────────────────────────────

/** Get only the tickers that should be imported (valid + unknown, no duplicates) */
export function getImportableTickers(result: ImportResult): string[] {
  return result.tickers
    .filter((t) => t.status === "valid" || t.status === "unknown")
    .map((t) => t.cleaned);
}
