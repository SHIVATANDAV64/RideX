import { Client, TablesDB, Query } from 'node-appwrite';

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || null;
}

function generateOtp() {
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String((arr[0] % 9000) + 1000);
  } catch {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
}

export default async ({ req, res, log, error }) => {
  const ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB_ID = process.env.APPWRITE_DB_ID;
  const TABLE = {
    DRIVER_PROFILES: process.env.APPWRITE_TABLE_DRIVER_PROFILES,
    RIDES: process.env.APPWRITE_TABLE_RIDES,
    RIDE_OFFERS: process.env.APPWRITE_TABLE_RIDE_OFFERS,
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

  const { rideId, driverId, offerId } = body;

  if (!rideId || !driverId || !offerId) {
    return res.json({ ok: false, message: 'rideId, driverId and offerId are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== driverId) {
    return res.json({ ok: false, message: 'Unauthorized ride acceptance request' }, 403);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  let ride;
  let offer;
  let driverProfile;

  try {
    ride = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
    });

    offer = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      rowId: offerId,
    });

    const driverProfiles = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      queries: [Query.equal('user_id', driverId), Query.limit(1)],
    });

    driverProfile = driverProfiles.rows[0];
  } catch (e) {
    error(`Accept ride lookup failed: ${e.message}`);
    return res.json({ ok: false, message: 'Ride, offer, or driver profile not found' }, 404);
  }

  if (!driverProfile) {
    return res.json({ ok: false, message: 'Driver profile not found' }, 404);
  }

  if (ride.status !== 'searching') {
    return res.json({ ok: false, message: `Ride is already ${ride.status}` }, 409);
  }

  if (offer.ride_id !== rideId || offer.driver_id !== driverId) {
    return res.json({ ok: false, message: 'Offer does not belong to this driver or ride' }, 403);
  }

  if (offer.status !== 'pending') {
    return res.json({ ok: false, message: `Offer is already ${offer.status}` }, 409);
  }

  const otp = ride.otp || generateOtp();

  try {
    const transaction = await tablesDB.createTransaction();

    await tablesDB.updateRows({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      data: { status: 'expired' },
      queries: [Query.equal('ride_id', rideId), Query.equal('status', 'pending')],
      transactionId: transaction.$id,
    });

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      rowId: offerId,
      data: { status: 'accepted' },
      transactionId: transaction.$id,
    });

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
      data: {
        status: 'driver_assigned',
        driver_id: driverId,
        driver_profile_id: driverProfile.$id,
        driver_name: driverProfile.name,
        driver_phone: driverProfile.phone || '',
        driver_vehicle_name: driverProfile.vehicle_name || '',
        driver_plate_number: driverProfile.plate_number,
        driver_rating: driverProfile.rating || 5,
        driver_photo_url: driverProfile.photo_url || '',
        driver_lat: driverProfile.current_lat,
        driver_lng: driverProfile.current_lng,
        driver_eta: offer.duration_min || 0,
        otp,
      },
      transactionId: transaction.$id,
    });

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      rowId: driverProfile.$id,
      data: { is_online: false },
      transactionId: transaction.$id,
    });

    await tablesDB.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
    log(`Ride ${rideId} accepted by driver ${driverId}`);
  } catch (e) {
    error(`Failed to accept ride ${rideId}: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to accept ride' }, 409);
  }

  return res.json({
    ok: true,
    rideId,
    status: 'driver_assigned',
    pickupAddress: ride.pickup_address,
    pickupLat: ride.pickup_lat,
    pickupLng: ride.pickup_lng,
    dropoffAddress: ride.dropoff_address,
    dropoffLat: ride.dropoff_lat,
    dropoffLng: ride.dropoff_lng,
    estimatedFare: ride.estimated_fare,
    otp,
  });
};
