/** The browser's position, with clear failure reasons. The user is always asked by the browser first; nothing is read silently. */
export type GeoFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';
export class GeoError extends Error {
  constructor(public reason: GeoFailure) { super(reason); }
}
export interface Position { latitude: number; longitude: number; accuracy: number }

export function getPosition(timeoutMs = 15000): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new GeoError('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new GeoError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
