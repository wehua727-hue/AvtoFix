import type { DevicesResponse } from '@shared/api';

export async function fetchDevices(): Promise<DevicesResponse> {
  const res = await fetch('/api/devices/list');
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}
