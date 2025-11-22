import React, { useEffect, useMemo, useRef, useState } from "react";
import bwipjs from "bwip-js";

declare global {
  interface Window {
    electronAPI?: {
      printersList: () => Promise<PrinterInfo[]>;
      printerPaperSizes: (printerName: string) => Promise<PaperSize[]>;
      printCustom: (args: PrintArgs) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

type PrinterInfo = {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  status?: string;
  deviceId?: string;
  options?: Record<string, any>;
};

type PaperSize = {
  name: string;
  widthMm: number;
  heightMm: number;
};

type PrintArgs = {
  html: string;
  printer?: string;
  landscape?: boolean;
  margins?: "default" | "none" | "minimum";
  pageSize?: { widthMm: number; heightMm: number };
};

const defaultPaperSizes: PaperSize[] = [
  { name: "58mm", widthMm: 58, heightMm: 200 },
  { name: "80mm", widthMm: 80, heightMm: 200 },
  { name: "A5", widthMm: 148, heightMm: 210 },
  { name: "A4", widthMm: 210, heightMm: 297 },
];

function mm(val: number) {
  return `${val}mm`;
}

export default function PrintPanel() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>(defaultPaperSizes);
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(defaultPaperSizes[0]);
  const [name, setName] = useState("Mahsulot nomi");
  const [price, setPrice] = useState<string>("120000");
  const [code, setCode] = useState("ABC-12345");
  const [barcodeType, setBarcodeType] = useState<"ean13" | "code128">("code128");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = (await window.electronAPI?.printersList?.()) || [];
        setPrinters(list);
        const def = list.find((p) => p.isDefault) || list[0];
        if (def) {
          setSelectedPrinter(def.name);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedPrinter) return;
      try {
        const sizes = (await window.electronAPI?.printerPaperSizes?.(selectedPrinter)) || defaultPaperSizes;
        const filtered = sizes.filter((s) => s.widthMm && s.heightMm);
        setPaperSizes(filtered.length ? filtered : defaultPaperSizes);
        setSelectedPaper((sp) => (filtered.length ? filtered[0] : sp));
      } catch {
        setPaperSizes(defaultPaperSizes);
      }
    })();
  }, [selectedPrinter]);

  useEffect(() => {
    // Render barcode preview on canvas
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const text = barcodeType === "ean13" ? normalizeEAN13(code) : code;
      bwipjs.toCanvas(canvas, {
        bcid: barcodeType, // Barcode type
        text,
        scale: 3,
        height: 10, // mm-like visual height proportion
        includetext: true,
        textxalign: "center",
      });
    } catch (e) {}
  }, [code, barcodeType]);

  const barcodeDataUrl = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }, [code, barcodeType]);

  function normalizeEAN13(value: string) {
    // Leave only digits and pad/truncate to 12 digits, checksum will be auto
    const digits = (value.match(/\d/g) || []).join("").slice(0, 12).padEnd(12, "0");
    return digits + computeEAN13Checksum(digits);
  }

  function computeEAN13Checksum(d12: string) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const n = Number(d12[i]);
      sum += i % 2 === 0 ? n : n * 3;
    }
    const mod = sum % 10;
    return String(mod === 0 ? 0 : 10 - mod);
  }

  async function onPrint() {
    const html = renderTicketHTML({
      widthMm: selectedPaper.widthMm,
      heightMm: selectedPaper.heightMm,
      name,
      price,
      code,
      barcodeDataUrl,
    });

    await window.electronAPI?.printCustom?.({
      html,
      printer: selectedPrinter,
      landscape: false,
      margins: "minimum",
      pageSize: { widthMm: selectedPaper.widthMm, heightMm: selectedPaper.heightMm },
    });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Pechat</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm">Printer</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
          >
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName || p.name} {p.isDefault ? "(default)" : ""}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500">
            {printers.find((p) => p.name === selectedPrinter)?.status || ""}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Paper size</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={selectedPaper?.name}
            onChange={(e) => {
              const p = paperSizes.find((x) => x.name === e.target.value);
              if (p) setSelectedPaper(p);
            }}
          >
            {paperSizes.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.widthMm} x {s.heightMm} mm)
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Barcode format</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={barcodeType}
            onChange={(e) => setBarcodeType(e.target.value as any)}
          >
            <option value="code128">Code128</option>
            <option value="ean13">EAN-13</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm">Mahsulot nomi</label>
          <input className="border rounded px-2 py-1 w-full" value={name} onChange={(e)=>setName(e.target.value)} />
          <label className="text-sm">Narxi</label>
          <input className="border rounded px-2 py-1 w-full" value={price} onChange={(e)=>setPrice(e.target.value)} />
          <label className="text-sm">Kodi</label>
          <input className="border rounded px-2 py-1 w-full" value={code} onChange={(e)=>setCode(e.target.value)} />
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-2">Preview</div>
          <div
            className="border rounded p-3"
            style={{ width: mm(selectedPaper.widthMm), minHeight: mm(Math.min(selectedPaper.heightMm, 120)) }}
          >
            <div className="text-center font-semibold mb-2">{name}</div>
            <div className="flex justify-between text-sm mb-1">
              <span>Narxi:</span>
              <span>{Number(price).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Kod:</span>
              <span>{code}</span>
            </div>
            <div className="flex justify-center">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <button onClick={onPrint} className="bg-blue-600 text-white px-4 py-2 rounded">Pechat</button>
      </div>
    </div>
  );
}

function renderTicketHTML(args: { widthMm: number; heightMm: number; name: string; price: string; code: string; barcodeDataUrl: string; }) {
  const { widthMm, heightMm, name, price, code, barcodeDataUrl } = args;
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 2mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      .ticket { width: ${widthMm}mm; min-height: ${Math.min(heightMm, 120)}mm; padding: 4mm; box-sizing: border-box; }
      .row { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 12px; }
      .title { text-align:center; font-weight: 700; margin-bottom: 3mm; font-size: 14px; }
      .center { text-align:center; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="title">${escapeHtml(name)}</div>
      <div class="row"><span>Narxi:</span><span>${Number(price).toLocaleString()}</span></div>
      <div class="row"><span>Kod:</span><span>${escapeHtml(code)}</span></div>
      <div class="center">
        <img src="${barcodeDataUrl}" alt="barcode" />
      </div>
    </div>
  </body>
  </html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]+/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c] as string));
}
