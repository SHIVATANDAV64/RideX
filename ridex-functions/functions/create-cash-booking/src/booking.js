import { createHash } from 'node:crypto';

const VEHICLE_PRICING = {
  bike: { baseFare: 15, perKm: 4, perMin: 0.5 },
  auto: { baseFare: 25, perKm: 6, perMin: 0.8 },
  mini: { baseFare: 50, perKm: 10, perMin: 1.2 },
  sedan: { baseFare: 70, perKm: 13, perMin: 1.5 },
  prime: { baseFare: 120, perKm: 18, perMin: 2.0 },
};

export function normalizePromoCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return normalized.length > 0 && normalized.length <= 30 ? normalized : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCoordinate(lat, lng) {
  return isFiniteNumber(lat) && isFiniteNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function validateBookingShape(booking, expectedPaymentMethod) {
  if (!booking || typeof booking !== 'object') {
    return false;
  }

  if (!booking.pickup || !booking.dropoff || typeof booking.requestId !== 'string') {
    return false;
  }

  if (booking.requestId.trim().length < 16 || booking.requestId.trim().length > 80) {
    return false;
  }

  if (!isCoordinate(booking.pickup.lat, booking.pickup.lng) || !isCoordinate(booking.dropoff.lat, booking.dropoff.lng)) {
    return false;
  }

  if (typeof booking.pickup.address !== 'string' || booking.pickup.address.trim().length === 0) {
    return false;
  }

  if (typeof booking.dropoff.address !== 'string' || booking.dropoff.address.trim().length === 0) {
    return false;
  }

  if (!Object.hasOwn(VEHICLE_PRICING, booking.vehicleType)) {
    return false;
  }

  if (booking.paymentMethod !== expectedPaymentMethod) {
    return false;
  }

  if (booking.routeDistanceKm !== null && booking.routeDistanceKm !== undefined && (!isFiniteNumber(booking.routeDistanceKm) || booking.routeDistanceKm < 0)) {
    return false;
  }

  if (booking.routeDurationMin !== null && booking.routeDurationMin !== undefined && (!isFiniteNumber(booking.routeDurationMin) || booking.routeDurationMin < 0)) {
    return false;
  }

  return true;
}

export function computeBookingAmounts(booking, promoDoc) {
  const { routeDistanceKm, routeDurationMin } = resolveRouteMetrics(booking);
  const baseFare = estimateFare(booking.vehicleType, routeDistanceKm, routeDurationMin);
  const discountAmount = calculatePromoDiscount(baseFare, promoDoc);

  return {
    routeDistanceKm,
    routeDurationMin,
    baseFare,
    discountAmount,
    estimatedFare: Math.round((baseFare - discountAmount) * 100) / 100,
  };
}

export function stableRowId(...parts) {
  return createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 36);
}

function estimateFare(vehicleType, distanceKm, durationMin) {
  const pricing = VEHICLE_PRICING[vehicleType];
  if (!pricing) {
    throw new Error('Unsupported vehicle type');
  }

  const rawFare = pricing.baseFare + pricing.perKm * distanceKm + pricing.perMin * durationMin;
  const estimatedFare = Math.round(rawFare);
  return Math.round(estimatedFare * 0.9);
}

function resolveRouteMetrics(booking) {
  const routeDistanceKm = booking.routeDistanceKm ?? haversineKm(
    booking.pickup.lat,
    booking.pickup.lng,
    booking.dropoff.lat,
    booking.dropoff.lng,
  );
  const routeDurationMin = booking.routeDurationMin ?? Math.max(1, Math.round((routeDistanceKm / 25) * 60));

  return {
    routeDistanceKm: Math.round(routeDistanceKm * 100) / 100,
    routeDurationMin: Math.round(routeDurationMin),
  };
}

function calculatePromoDiscount(fare, promoDoc) {
  if (!promoDoc) {
    return 0;
  }

  if (promoDoc.expires_at && new Date(promoDoc.expires_at) < new Date()) {
    throw new Error('Promo code has expired');
  }

  if (fare < (promoDoc.min_fare || 0)) {
    throw new Error(`Minimum fare of ₹${promoDoc.min_fare} required for this promo`);
  }

  let discount;
  if (promoDoc.discount_type === 'percent') {
    discount = Math.min((fare * promoDoc.discount_value) / 100, promoDoc.max_discount || Infinity);
  } else {
    discount = Math.min(promoDoc.discount_value, promoDoc.max_discount || promoDoc.discount_value);
  }

  discount = Math.min(discount, fare);
  return Math.round(discount * 100) / 100;
}

function haversineKm(lat1, lng1, lat2, lng2) {
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