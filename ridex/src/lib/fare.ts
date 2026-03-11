// src/lib/fare.ts — Client-side fare estimation
export interface FareEstimate {
  vehicleType: VehicleType;
  label: string;
  baseFare: number;
  perKm: number;
  perMin: number;
  estimatedFare: number;
  fareMin: number;
  fareMax: number;
  surgeMultiplier: number;
  etaMin: number; // minutes display
  icon: string;
  capacity: number;
}

export type VehicleType = 'bike' | 'auto' | 'mini' | 'sedan' | 'prime';

const VEHICLE_CONFIG: Omit<FareEstimate, 'estimatedFare' | 'fareMin' | 'fareMax' | 'surgeMultiplier' | 'etaMin'>[] = [
  { vehicleType: 'bike',  label: 'Bike',    baseFare: 15,  perKm: 4,   perMin: 0.5, icon: '🏍️',  capacity: 1 },
  { vehicleType: 'auto',  label: 'Auto',    baseFare: 25,  perKm: 6,   perMin: 0.8, icon: '🛺',   capacity: 3 },
  { vehicleType: 'mini',  label: 'Mini',    baseFare: 50,  perKm: 10,  perMin: 1.2, icon: '🚗',   capacity: 4 },
  { vehicleType: 'sedan', label: 'Ride',    baseFare: 70,  perKm: 13,  perMin: 1.5, icon: '🚙',   capacity: 4 },
  { vehicleType: 'prime', label: 'Prime',   baseFare: 120, perKm: 18,  perMin: 2.0, icon: '🚘',   capacity: 4 },
];

export function estimateFares(
  distanceKm: number,
  durationMin: number,
  surgeMultiplier = 1,
): FareEstimate[] {
  return VEHICLE_CONFIG.map((v, i) => {
    const raw = v.baseFare + v.perKm * distanceKm + v.perMin * durationMin;
    const estimatedFare = Math.round(raw * surgeMultiplier);
    const fareMin = Math.round(estimatedFare * 0.9);
    const fareMax = Math.round(estimatedFare * 1.1);
    return {
      ...v,
      estimatedFare,
      fareMin,
      fareMax,
      surgeMultiplier,
      etaMin: Math.round(3 + i * 1.5 + Math.random() * 2),
    };
  });
}

export function formatFare(amount: number): string {
  return `₹${amount.toFixed(0)}`;
}

/** Haversine distance in km between two lat/lng pairs */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
