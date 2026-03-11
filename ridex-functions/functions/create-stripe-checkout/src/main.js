import Stripe from 'stripe';
import { Client, Query, TablesDB } from 'node-appwrite';
import { computeBookingAmounts, normalizePromoCode, validateBookingShape } from './booking.js';

function toValidBaseUrl(value, fallback) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export default async ({ req, res, error }) => {
  if (req.method !== 'POST') {
    return res.json({ ok: false, message: 'Method not allowed' }, 405);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const defaultBaseUrl = process.env.APP_BASE_URL;
  const currency = (process.env.STRIPE_CURRENCY).toLowerCase();
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const promoTableId = process.env.APPWRITE_TABLE_PROMO_CODES;

  if (!secretKey) {
    return res.json({ ok: false, message: 'Stripe is not configured' }, 500);
  }

  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const { baseUrl, riderEmail, booking } = body;

  if (!validateBookingShape(booking, 'stripe_test')) {
    return res.json({ ok: false, message: 'A valid Stripe booking payload is required' }, 400);
  }

  const resolvedBaseUrl = toValidBaseUrl(baseUrl, defaultBaseUrl);
  if (!resolvedBaseUrl) {
    return res.json({ ok: false, message: 'Invalid baseUrl' }, 400);
  }

  try {
    const client = new Client()
      .setEndpoint(ENDPOINT)
      .setProject(PROJECT_ID)
      .setKey(API_KEY);
    const tablesDB = new TablesDB(client);

    const normalizedPromoCode = normalizePromoCode(booking.promoCode);
    if (booking.promoCode && !normalizedPromoCode) {
      return res.json({ ok: false, message: 'Invalid promo code format' }, 400);
    }

    let promoDoc = null;
    if (normalizedPromoCode) {
      const promos = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: promoTableId,
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

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: typeof riderEmail === 'string' ? riderEmail : undefined,
      success_url: `${resolvedBaseUrl}/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${resolvedBaseUrl}/payment/stripe/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round(amounts.estimatedFare * 100),
            product_data: {
              name: `RideX ${String(booking.vehicleType || 'ride').toUpperCase()} ride`,
              description: `${booking.pickup.address} -> ${booking.dropoff.address}`,
            },
          },
        },
      ],
      metadata: {
        vehicleType: String(booking.vehicleType || ''),
        pickupAddress: String(booking.pickup.address || '').slice(0, 300),
        dropoffAddress: String(booking.dropoff.address || '').slice(0, 300),
        routeDistanceKm: String(amounts.routeDistanceKm),
        routeDurationMin: String(amounts.routeDurationMin),
        estimatedFare: String(amounts.estimatedFare),
        discountAmount: String(amounts.discountAmount),
        promoCode: normalizedPromoCode || '',
      },
    });

    return res.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      paymentStatus: session.payment_status,
      estimatedFare: amounts.estimatedFare,
    });
  } catch (err) {
    error(`Failed to create Stripe Checkout Session: ${err.message}`);
    return res.json({ ok: false, message: 'Could not create Stripe Checkout Session' }, 500);
  }
};