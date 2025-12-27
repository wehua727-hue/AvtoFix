import { RequestHandler } from 'express';
import type { DevicesResponse } from '@shared/api';

// Browser mode fallback: no demo devices, Electron will provide real printers
export const handleDevicesList: RequestHandler<{}, DevicesResponse> = async (_req, res) => {
  const printers: DevicesResponse['printers'] = [];
  const others: DevicesResponse['others'] = [];

  res.json({ printers, others });
};
