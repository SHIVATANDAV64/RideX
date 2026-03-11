import type { Location, PaymentMethod } from '../contexts/RideContext';
import type { VehicleType } from './fare';

const PENDING_BOOKING_KEY = 'ridex.pending-booking';

export interface PendingBooking {
  requestId: string;
  pickup: Location;
  dropoff: Location;
  vehicleType: VehicleType;
  estimatedFare: number;
  routeDistanceKm: number | null;
  routeDurationMin: number | null;
  paymentMethod: PaymentMethod;
  promoCode: string | null;
  discountAmount: number;
}

export function savePendingBooking(booking: PendingBooking) {
  sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(booking));
}

export function getPendingBooking(): PendingBooking | null {
  const value = sessionStorage.getItem(PENDING_BOOKING_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as PendingBooking;
  } catch {
    sessionStorage.removeItem(PENDING_BOOKING_KEY);
    return null;
  }
}

export function clearPendingBooking() {
  sessionStorage.removeItem(PENDING_BOOKING_KEY);
}