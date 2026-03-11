import { Client, TablesDB, Query, ID } from 'node-appwrite';

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || null;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Great-circle distance in kilometres using the Haversine formula.
 */
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

/**
 * Cryptographically-adequate 4-digit OTP using the runtime's crypto module.
 * Falls back to Math.random() if crypto is unavailable (should not happen in Node 21).
 */
function generateOtp() {
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String((arr[0] % 9000) + 1000); // guaranteed 4-digit (1000-9999)
  } catch {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
}

/**
 * Rough ETA estimate: distance / average city speed (25 km/h) in minutes.
 */
function etaMin(distanceKm) {
  return Math.max(1, Math.round((distanceKm / 25) * 60));
}

// ─── Main ────────────────────────────────────────────────────────────────────

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

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);
  const trigger = getHeader(req, 'x-appwrite-trigger');

  let ride;
  let manualRematch = false;
  try {
    if (trigger === 'event') {
      ride = JSON.parse(req.body || '{}');
    } else {
      if (req.method !== 'POST') {
        return res.json({ ok: false, message: 'Method not allowed' }, 405);
      }

      const body = JSON.parse(req.body || '{}');
      const rideId = body.rideId;
      const callerUserId = getHeader(req, 'x-appwrite-user-id');

      if (!rideId || !callerUserId) {
        return res.json({ ok: false, message: 'rideId and authenticated rider are required' }, 400);
      }

      ride = await tablesDB.getRow({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        rowId: rideId,
      });

      if (ride.rider_id !== callerUserId) {
        return res.json({ ok: false, message: 'Only the rider can retry matching' }, 403);
      }

      manualRematch = true;
    }
  } catch {
    error('Invalid event payload');
    return res.json({ ok: false, message: 'Invalid payload' }, 400);
  }

  const rideId = ride.$id;
  const vehicleType = ride.vehicle_type;
  const pickupLat = ride.pickup_lat;
  const pickupLng = ride.pickup_lng;
  const rideStatus = ride.status;

  if (rideStatus && rideStatus !== 'searching') {
    return res.json({ ok: true, matched: false, message: 'Ride is no longer searchable' });
  }

  if (!rideId || !vehicleType || pickupLat === undefined || pickupLng === undefined) {
    error(`Missing required ride fields: id=${rideId} vehicle=${vehicleType}`);
    return res.json({ ok: false, message: 'Missing ride fields' }, 400);
  }

  log(`Matching driver for ride ${rideId} — vehicle: ${vehicleType}`);

  let existingOffersResponse;
  const nowIso = new Date().toISOString();
  try {
    existingOffersResponse = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      queries: [Query.equal('ride_id', rideId), Query.limit(100)],
    });
  } catch (e) {
    error(`Failed to query existing ride offers: ${e.message}`);
    return res.json({ ok: false, message: 'Ride offer lookup failed' }, 500);
  }

  const stalePendingOffers = existingOffersResponse.rows.filter(
    (offer) => offer.status === 'pending' && offer.expires_at && offer.expires_at < nowIso,
  );

  if (stalePendingOffers.length > 0) {
    await Promise.all(stalePendingOffers.map((offer) => tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      rowId: offer.$id,
      data: { status: 'expired' },
    }).catch(() => null)));
  }

  const activePendingOffers = existingOffersResponse.rows.filter(
    (offer) => offer.status === 'pending' && offer.expires_at && offer.expires_at >= nowIso,
  );

  if (manualRematch && activePendingOffers.length > 0) {
    return res.json({ ok: true, matched: false, message: 'Current driver offers are still active', rideId, offersCreated: 0 });
  }

  const excludedDriverIds = new Set(
    existingOffersResponse.rows
      .filter((offer) => ['pending', 'accepted', 'declined'].includes(offer.status))
      .map((offer) => offer.driver_id),
  );

  let driversResponse;
  try {
    driversResponse = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      queries: [
        Query.equal('vehicle_type', vehicleType),
        Query.equal('is_online', true),
        Query.equal('is_verified', true),
        Query.limit(50),
      ],
    });
  } catch (e) {
    error(`Failed to query drivers: ${e.message}`);
    return res.json({ ok: false, message: 'Driver query failed' }, 500);
  }

  const candidateDrivers = driversResponse.rows.filter(
    (driver) => driver.current_lat !== null && driver.current_lng !== null && !excludedDriverIds.has(driver.user_id),
  );

  if (candidateDrivers.length === 0) {
    log(`No online ${vehicleType} drivers available for ride ${rideId}`);
    return res.json({ ok: true, matched: false, message: 'No drivers available' });
  }

  const ranked = candidateDrivers
    .map(driver => ({
      ...driver,
      distanceKm: haversineKm(pickupLat, pickupLng, driver.current_lat, driver.current_lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const shortlisted = ranked.slice(0, 5);
  const expiresAt = new Date(Date.now() + 15_000).toISOString();

  try {
    await Promise.all(shortlisted.map((driver) => tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDE_OFFERS,
      rowId: ID.unique(),
      data: {
        ride_id: rideId,
        driver_id: driver.user_id,
        driver_profile_id: driver.$id,
        rider_name: ride.rider_name || 'Rider',
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        distance_km: Math.round(driver.distanceKm * 100) / 100,
        duration_min: etaMin(driver.distanceKm),
        estimated_fare: ride.estimated_fare,
        vehicle_type: ride.vehicle_type,
        status: 'pending',
        expires_at: expiresAt,
      },
    })));
    log(`Created ${shortlisted.length} ride offers for ride ${rideId}`);
  } catch (e) {
    error(`Failed to create ride offers for ${rideId}: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to create ride offers' }, 500);
  }

  return res.json({
    ok: true,
    matched: shortlisted.length > 0,
    rideId,
    offersCreated: shortlisted.length,
    nearestDriverId: shortlisted[0]?.user_id ?? null,
    nearestDriverEta: shortlisted[0] ? etaMin(shortlisted[0].distanceKm) : null,
    otp: generateOtp(),
  });
};
