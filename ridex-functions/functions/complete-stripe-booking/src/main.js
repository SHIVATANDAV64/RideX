import Stripe from 'stripe';
import { Client, Query, TablesDB } from 'node-appwrite';
import { computeBookingAmounts, normalizePromoCode, stableRowId, validateBookingShape } from './booking.js';

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || null;
}

const TABLE = {
  PAYMENTS: process.env.APPWRITE_TABLE_PAYMENTS,
  PROMO_CODES: process.env.APPWRITE_TABLE_PROMO_CODES,
  RIDES: process.env.APPWRITE_TABLE_RIDES,
};

export default async ({ req, res, error, log }) => {
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (req.method !== 'POST') {
    return res.json({ ok: false, message: 'Method not allowed' }, 405);
  }

  if (!secretKey) {
    return res.json({ ok: false, message: 'Stripe is not configured' }, 500);
  }

  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const { sessionId, riderId, riderName, booking } = body;

  if (!sessionId || !riderId || !validateBookingShape(booking, 'stripe_test')) {
    return res.json({ ok: false, message: 'sessionId, riderId, and booking are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== riderId) {
    return res.json({ ok: false, message: 'Unauthorized Stripe completion request' }, 403);
  }

  const stripe = new Stripe(secretKey);

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  try {
    const existingPayments = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.PAYMENTS,
      queries: [Query.equal('provider_reference', sessionId), Query.limit(1)],
    });

    if (existingPayments.total > 0) {
      const payment = existingPayments.rows[0];
      const rides = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        queries: [Query.equal('payment_id', payment.$id), Query.limit(1)],
      });

      const ride = rides.rows[0] ?? null;
      if (!ride) {
        return res.json({ ok: false, message: 'Payment exists but booking is incomplete' }, 409);
      }

      if (ride.rider_id !== riderId) {
        return res.json({ ok: false, message: 'Payment does not belong to this rider' }, 403);
      }

      if (ride) {
        return res.json({
          ok: true,
          rideId: ride.$id,
          status: ride.status,
          estimatedFare: ride.estimated_fare,
          duplicate: true,
        });
      }
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return res.json({ ok: false, message: 'Stripe session is not fully paid' }, 409);
    }

    const normalizedPromoCode = normalizePromoCode(booking.promoCode);
    if (booking.promoCode && !normalizedPromoCode) {
      return res.json({ ok: false, message: 'Invalid promo code format' }, 400);
    }

    const paymentId = stableRowId('stripe-payment', session.id);
    const rideId = stableRowId('stripe-ride', session.id);
    const transaction = await tablesDB.createTransaction();

    let promoDoc = null;
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
    const paidAmount = typeof session.amount_total === 'number' ? session.amount_total / 100 : null;

    if (paidAmount === null || Math.abs(paidAmount - amounts.estimatedFare) > 0.01) {
      return res.json({ ok: false, message: 'Paid Stripe amount does not match server-calculated fare' }, 409);
    }

    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.PAYMENTS,
      rowId: paymentId,
      data: {
        ride_id: rideId,
        rider_id: riderId,
        driver_id: null,
        amount: amounts.estimatedFare,
        method: 'card',
        provider: 'stripe',
        provider_reference: session.id,
        receipt_url: null,
        promo_code: normalizedPromoCode,
        discount: amounts.discountAmount,
        status: 'paid',
      },
      transactionId: transaction.$id,
    });

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
        payment_method: 'stripe_test',
        payment_status: 'paid',
        payment_id: paymentId,
        provider_reference: session.id,
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
    log(`Completed Stripe booking for rider ${riderId} and ride ${rideId}`);

    return res.json({
      ok: true,
      rideId,
      status: 'searching',
      estimatedFare: amounts.estimatedFare,
      paymentId,
    });
  } catch (err) {
    try {
      const existingPayment = await tablesDB.getRow({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENTS,
        rowId: stableRowId('stripe-payment', sessionId),
      });
      const existingRide = await tablesDB.getRow({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        rowId: stableRowId('stripe-ride', sessionId),
      });

      if (existingRide.rider_id === riderId && existingPayment.provider_reference === sessionId) {
        return res.json({
          ok: true,
          rideId: existingRide.$id,
          status: existingRide.status,
          estimatedFare: existingRide.estimated_fare,
          paymentId: existingPayment.$id,
          duplicate: true,
        });
      }
    } catch {
      // Fall through to the generic error response.
    }

    error(`Failed to complete Stripe booking: ${err.message}`);
    return res.json({ ok: false, message: 'Could not complete Stripe booking' }, 500);
  }
};