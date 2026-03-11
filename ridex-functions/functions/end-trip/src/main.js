import { Client, TablesDB, Query, ID } from 'node-appwrite';

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || null;
}

export default async ({ req, res, log, error }) => {
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const TABLE = {
    DRIVER_PROFILES: process.env.APPWRITE_TABLE_DRIVER_PROFILES,
    PAYMENTS: process.env.APPWRITE_TABLE_PAYMENTS,
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

  const { rideId, driverId, finalFare, cashCollected = false } = body;

  if (!rideId || !driverId) {
    return res.json({ ok: false, message: 'rideId and driverId are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== driverId) {
    return res.json({ ok: false, message: 'Unauthorized trip completion request' }, 403);
  }

  // Validate finalFare is a reasonable number
  const fare = typeof finalFare === 'number' && finalFare > 0 ? finalFare : null;

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  let ride;
  let driverProfile;
  try {
    ride = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
    });

    const driverProfiles = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      queries: [Query.equal('user_id', driverId), Query.limit(1)],
    });
    driverProfile = driverProfiles.rows[0] ?? null;
  } catch (e) {
    error(`Ride not found: ${rideId} — ${e.message}`);
    return res.json({ ok: false, message: 'Ride not found' }, 404);
  }

  const endableStatuses = ['in_progress'];
  if (!endableStatuses.includes(ride.status)) {
    log(`Cannot end ride ${rideId} with status '${ride.status}'`);
    return res.json({ ok: false, message: `Ride cannot be ended from status: ${ride.status}` }, 409);
  }

  // ── Guard: only the assigned driver can end the trip ─────────────────────
  if (ride.driver_id !== driverId) {
    error(`Driver ${driverId} is not assigned to ride ${rideId}`);
    return res.json({ ok: false, message: 'Not assigned to this ride' }, 403);
  }

  const prepaidMethods = ['stripe_test'];
  const prepaid = prepaidMethods.includes(ride.payment_method);
  const paymentSettled = prepaid || Boolean(cashCollected);
  const resolvedFare = prepaid ? ride.estimated_fare : (fare ?? ride.estimated_fare);
  const completedAt = new Date().toISOString();

  let paymentId = null;
  try {
    const transaction = await tablesDB.createTransaction();

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
      data: {
        status: 'completed',
        final_fare: resolvedFare,
        completed_at: completedAt,
        payment_status: paymentSettled ? 'paid' : 'pending',
      },
      transactionId: transaction.$id,
    });

    if (prepaid && ride.payment_id) {
      paymentId = ride.payment_id;
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENTS,
        rowId: ride.payment_id,
        data: {
          ride_id: rideId,
          driver_id: driverId,
          amount: resolvedFare,
          status: paymentSettled ? 'paid' : 'pending',
        },
        transactionId: transaction.$id,
      });
    } else {
      paymentId = ID.unique();
      await tablesDB.createRow({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENTS,
        rowId: paymentId,
        data: {
          ride_id: rideId,
          rider_id: ride.rider_id,
          driver_id: driverId,
          amount: resolvedFare,
          method: ride.payment_method === 'stripe_test' ? 'card' : 'cash',
          provider: ride.payment_method === 'stripe_test' ? 'stripe' : 'offline',
          provider_reference: ride.provider_reference || null,
          promo_code: ride.promo_code || null,
          discount: ride.discount_amount || 0,
          status: paymentSettled ? 'paid' : 'pending',
        },
        transactionId: transaction.$id,
      });
    }

    if (driverProfile) {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.DRIVER_PROFILES,
        rowId: driverProfile.$id,
        data: {
          total_rides: (driverProfile.total_rides || 0) + 1,
          is_online: true,
        },
        transactionId: transaction.$id,
      });
    }

    await tablesDB.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
    log(`Ride ${rideId} → completed (fare: ₹${resolvedFare})`);
  } catch (e) {
    error(`Failed to complete ride ${rideId}: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to complete ride' }, 500);
  }

  return res.json({
    ok: true,
    rideId,
    status: 'completed',
    finalFare: resolvedFare,
    paymentId: paymentId ?? null,
    completedAt,
  });
};
