import { Client, Query, TablesDB } from 'node-appwrite';
import { computeBookingAmounts, normalizePromoCode, stableRowId, validateBookingShape } from './booking.js';

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || null;
}

export default async ({ req, res, error }) => {
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const TABLE = {
    PROMO_CODES: process.env.APPWRITE_TABLE_PROMO_CODES,
    RIDES: process.env.APPWRITE_TABLE_RIDES,
  };

  if (req.method !== 'POST') {
    return res.json({ ok: false, message: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const { riderId, riderName, booking } = body;
  if (!riderId || !validateBookingShape(booking, 'cash')) {
    return res.json({ ok: false, message: 'riderId and a valid cash booking are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== riderId) {
    return res.json({ ok: false, message: 'Unauthorized cash booking request' }, 403);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  try {
    const normalizedPromoCode = normalizePromoCode(booking.promoCode);
    let promoDoc = null;
    if (booking.promoCode && !normalizedPromoCode) {
      return res.json({ ok: false, message: 'Invalid promo code format' }, 400);
    }

    if (normalizedPromoCode) {
      const promos = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: TABLE.PROMO_CODES,
        queries: [Query.equal('code', normalizedPromoCode), Query.equal('is_active', true), Query.limit(1)],
      });

      promoDoc = promos.rows[0] ?? null;
      if (!promoDoc) {
        return res.json({ ok: false, message: 'Promo code is no longer valid' }, 409);
      }

      if (promoDoc.expires_at && new Date(promoDoc.expires_at) < new Date()) {
        return res.json({ ok: false, message: 'Promo code has expired' }, 409);
      }

      if (promoDoc.usage_count >= promoDoc.usage_limit) {
        return res.json({ ok: false, message: 'Promo code usage limit reached' }, 409);
      }
    }

    const amounts = computeBookingAmounts({
      ...booking,
      promoCode: normalizedPromoCode,
    }, promoDoc);

    const rideId = stableRowId('cash-ride', riderId, booking.requestId);
    const transaction = await tablesDB.createTransaction();

    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
      data: {
        rider_id: riderId,
        rider_name: riderName || 'Rider',
        pickup_address: booking.pickup.address,
        pickup_lat: booking.pickup.lat,
        pickup_lng: booking.pickup.lng,
        dropoff_address: booking.dropoff.address,
        dropoff_lat: booking.dropoff.lat,
        dropoff_lng: booking.dropoff.lng,
        route_distance_km: amounts.routeDistanceKm,
        route_duration_min: amounts.routeDurationMin,
        vehicle_type: booking.vehicleType,
        estimated_fare: amounts.estimatedFare,
        payment_method: 'cash',
        payment_status: 'pending',
        promo_code: normalizedPromoCode,
        discount_amount: amounts.discountAmount,
        status: 'searching',
      },
      transactionId: transaction.$id,
    });

    if (promoDoc) {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.PROMO_CODES,
        rowId: promoDoc.$id,
        data: {
          usage_count: promoDoc.usage_count + 1,
        },
        transactionId: transaction.$id,
      });
    }

    await tablesDB.updateTransaction({ transactionId: transaction.$id, commit: true });

    return res.json({
      ok: true,
      rideId,
      status: 'searching',
      estimatedFare: amounts.estimatedFare,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists|conflict|duplicate/i.test(message)) {
      try {
        const existingRide = await tablesDB.getRow({
          databaseId: DB_ID,
          tableId: TABLE.RIDES,
          rowId: stableRowId('cash-ride', riderId, booking.requestId),
        });

        if (existingRide.rider_id === riderId) {
          return res.json({
            ok: true,
            rideId: existingRide.$id,
            status: existingRide.status,
            estimatedFare: existingRide.estimated_fare,
            duplicate: true,
          });
        }
      } catch {
        // Fall through to the generic error response.
      }
    }

    error(`Failed to create cash booking: ${err.message}`);
    return res.json({ ok: false, message: 'Could not create ride booking' }, 500);
  }
};