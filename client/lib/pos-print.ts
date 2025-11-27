import type { POSTransaction, POSDevice, PrintRequest, PrintResponse } from '@shared/api';

// Simple client service to send print job to server and also trigger browser print
export async function dispatchPrint(
  transaction: POSTransaction,
  copies: number,
  devices: POSDevice[],
  options?: { deviceIds?: string[]; deviceCopies?: Record<string, number> }
): Promise<PrintResponse> {
  const body: PrintRequest = { transaction, copies, devices, ...options };

  const resp = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Fire-and-forget print preview in browser (for connected OS printers)
  try {
    openReceiptWindow(transaction, copies);
  } catch {}

  if (!resp.ok) {
    return { success: false, dispatchedTo: [], message: 'Server error' };
  }
  return resp.json();
}

function openReceiptWindow(tx: POSTransaction, copies: number) {
  const win = window.open('', '_blank', 'width=420,height=600');
  if (!win) return;

  const styles = `
    body { font-family: ui-monospace, Menlo, Consolas, monospace; padding: 12px; }
    .receipt { border: 1px dashed #999; padding: 10px; margin-bottom: 12px; }
    .hdr { font-weight: 700; font-size: 14px; margin-bottom: 6px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 4px 0; }
    .right { text-align: right; }
    .total { font-weight: 700; border-top: 1px dashed #999; margin-top: 6px; padding-top: 6px; }
  `;

  const receiptHtml = (index: number) => `
    <div class="receipt">
      <div class="hdr">OfflineStore — Check #${index + 1}</div>
      <div class="meta">TX: ${tx.id} • ${new Date(tx.createdAt).toLocaleString()}</div>
      <table>
        <thead>
          <tr><th>Nomi</th><th class="right">Soni</th><th class="right">Narx</th></tr>
        </thead>
        <tbody>
          ${tx.lines.map(l => `<tr><td>${escapeHtml(l.name)}</td><td class="right">${l.qty}</td><td class="right">${formatMoney(l.price * l.qty)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="total">Jami: ${formatMoney(tx.total)}</div>
    </div>
  `;

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Check</title><style>${styles}</style></head><body>${
    Array.from({ length: copies }).map((_, i) => receiptHtml(i)).join('')
  }</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function formatMoney(n: number) { return new Intl.NumberFormat('uz-UZ').format(n) + ' so\'m'; }
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] as string)); }
