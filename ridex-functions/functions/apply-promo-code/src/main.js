import { Client, TablesDB, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const TABLE = {
    PROMO_CODES: process.env.APPWRITE_TABLE_PROMO_CODES,
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

  const { promoCode, fare } = body;

  if (!promoCode || typeof fare !== 'number' || fare <= 0) {
    return res.json({ ok: false, message: 'promoCode and positive fare are required' }, 400);
  }

  // Sanitise promo code input — only allow alphanumeric and hyphens
  const sanitisedCode = String(promoCode).trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  if (sanitisedCode.length === 0 || sanitisedCode.length > 30) {
    return res.json({ ok: false, message: 'Invalid promo code format' }, 400);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  let promoDoc;
  try {
    const result = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.PROMO_CODES,
      queries: [
        Query.equal('code', sanitisedCode),
        Query.equal('is_active', true),
        Query.limit(1),
      ],
    });
    if (result.total === 0) {
      return res.json({ ok: false, message: 'Invalid or expired promo code' }, 404);
    }
    promoDoc = result.rows[0];
  } catch (e) {
    error(`Promo code lookup failed: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to validate promo code' }, 500);
  }

  // ── Validate expiry ───────────────────────────────────────────────────────
  if (promoDoc.expires_at && new Date(promoDoc.expires_at) < new Date()) {
    return res.json({ ok: false, message: 'This promo code has expired' }, 410);
  }

  // ── Validate usage limit ──────────────────────────────────────────────────
  if (promoDoc.usage_count >= promoDoc.usage_limit) {
    return res.json({ ok: false, message: 'Promo code usage limit reached' }, 410);
  }

  // ── Validate minimum fare ─────────────────────────────────────────────────
  if (fare < (promoDoc.min_fare || 0)) {
    return res.json({
      ok: false,
      message: `Minimum fare of ₹${promoDoc.min_fare} required for this promo`,
    }, 422);
  }

  // ── Calculate discount ────────────────────────────────────────────────────
  let discount;
  if (promoDoc.discount_type === 'percent') {
    discount = Math.min((fare * promoDoc.discount_value) / 100, promoDoc.max_discount || Infinity);
  } else {
    // flat
    discount = Math.min(promoDoc.discount_value, promoDoc.max_discount || promoDoc.discount_value);
  }
  discount = Math.min(discount, fare); // can't discount more than fare
  discount = Math.round(discount * 100) / 100;

  const discountedFare = Math.round((fare - discount) * 100) / 100;

  log(`Promo ${sanitisedCode} applied: ₹${fare} → ₹${discountedFare} (discount: ₹${discount})`);

  return res.json({
    ok: true,
    promoCode: sanitisedCode,
    originalFare: fare,
    discount,
    discountedFare,
  });
};
