import { RequestHandler } from 'express';
import type { PrintRequest, PrintResponse } from '@shared/api';

export const handlePrint: RequestHandler<{}, PrintResponse, PrintRequest> = async (req, res) => {
  try {
    const { transaction, copies, devices } = req.body || {};

    if (!transaction || !Array.isArray(transaction.lines) || !copies || !devices?.length) {
      return res.status(400).json({ success: false, dispatchedTo: [], message: 'Invalid payload' });
    }

    // Simulate dispatching to devices (printer, kitchen, prep, ...)
    // In a real app, integrate with device SDKs or Electron IPC here.
    // eslint-disable-next-line no-console
    console.log('[PRINT]', {
      id: transaction.id,
      copies,
      devices,
      total: transaction.total,
      lines: transaction.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price })),
    });

    return res.json({ success: true, dispatchedTo: devices });
  } catch (e) {
    return res.status(500).json({ success: false, dispatchedTo: [], message: 'Server error' });
  }
};
