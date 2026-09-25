/**
 * PDF table extraction pipeline:
 * PDF → text extraction (+table detection by coordinate clustering) → row/column reconstruction.
 * Scanned/image-only PDFs are flagged OCR_REQUIRED instead of guessed.
 */
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as pdfjsLib from 'pdfjs-dist';

let workerSet = false;
function ensureWorker() {
  if (workerSet) return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    workerSet = true;
  } catch {
    /* fake-worker fallback attempted by pdfjs */
  }
}

export interface PdfExtractResult {
  pages: number;
  rows: string[][];
  textLength: number;
  scanned: boolean; // image-only → OCR_REQUIRED
}

interface TextItem { page: number; x: number; y: number; str: string }

export async function extractPdfTables(buf: ArrayBuffer): Promise<PdfExtractResult> {
  ensureWorker();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const items: TextItem[] = [];
  let textLength = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = (it.str ?? '').trim();
      if (!str || !it.transform) continue;
      textLength += str.length;
      items.push({ page: p, x: it.transform[4], y: it.transform[5], str });
    }
  }

  if (textLength < 60) {
    return { pages: doc.numPages, rows: [], textLength, scanned: true };
  }

  // Cluster into visual rows (same page, y within tolerance), then split columns by x-gaps
  const rows: string[][] = [];
  const byPage = new Map<number, TextItem[]>();
  items.forEach((it) => {
    if (!byPage.has(it.page)) byPage.set(it.page, []);
    byPage.get(it.page)!.push(it);
  });

  byPage.forEach((list) => {
    list.sort((a, b) => b.y - a.y || a.x - b.x);
    let line: TextItem[] = [];
    let lineY: number | null = null;
    const flush = () => {
      if (!line.length) return;
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let prevEnd: number | null = null;
      line.forEach((it) => {
        if (prevEnd != null && it.x - prevEnd > 14) cells.push('');
        const last = cells.length ? cells[cells.length - 1] : null;
        if (last != null && it.x - (prevEnd ?? it.x) <= 14 && last !== '') {
          cells[cells.length - 1] = (last + ' ' + it.str).trim();
        } else {
          cells.push(it.str);
        }
        prevEnd = it.x + it.str.length * 4.2;
      });
      if (cells.some((c) => c.trim() !== '')) rows.push(cells);
      line = [];
      lineY = null;
    };
    list.forEach((it) => {
      if (lineY == null || Math.abs(it.y - lineY) <= 3) {
        line.push(it);
        lineY = lineY == null ? it.y : (lineY + it.y) / 2;
      } else {
        flush();
        line = [it];
        lineY = it.y;
      }
    });
    flush();
  });

  // Merge repeated table headers across pages (keep first occurrence only)
  const seenHeaders = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = r.join('|').toLowerCase();
    if (/^\s*type\s*\|/.test(key) || key.startsWith('type|') || (r[0] || '').toLowerCase() === 'type') {
      if (seenHeaders.has(key)) return false;
      seenHeaders.add(key);
    }
    return true;
  });

  return { pages: doc.numPages, rows: deduped, textLength, scanned: false };
}
