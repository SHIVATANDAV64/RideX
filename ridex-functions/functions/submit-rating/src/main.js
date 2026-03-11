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
    RATINGS: process.env.APPWRITE_TABLE_RATINGS,
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

  const { rideId, rating, comment = '', tags = [] } = body;

  if (!rideId || typeof rating !== 'number') {
    return res.json({ ok: false, message: 'rideId and numeric rating are required' }, 400);
  }

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.json({ ok: false, message: 'rating must be an integer between 1 and 5' }, 400);
  }

  if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) {
    return res.json({ ok: false, message: 'tags must be an array of strings' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId) {
    return res.json({ ok: false, message: 'Authentication required' }, 403);
  }

  // Sanitise comment to prevent injection
  const sanitisedComment = String(comment).trim().slice(0, 1000);
  const sanitisedTags = tags.map(t => String(t).trim().slice(0, 100)).filter(Boolean);

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  let ride;
  try {
    ride = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
    });
  } catch (e) {
    return res.json({ ok: false, message: 'Ride not found' }, 404);
  }

  if (ride.status !== 'completed') {
    return res.json({ ok: false, message: 'Ride is not yet completed' }, 409);
  }

  if (ride.rider_id !== callerUserId) {
    return res.json({ ok: false, message: 'Only the rider can submit a rating' }, 403);
  }

  const existing = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: TABLE.RATINGS,
    queries: [Query.equal('ride_id', rideId), Query.limit(1)],
  });
  if (existing.total > 0) {
    return res.json({ ok: false, message: 'Ride has already been rated' }, 409);
  }

  let driverProfile = null;
  if (ride.driver_profile_id) {
    try {
      driverProfile = await tablesDB.getRow({
        databaseId: DB_ID,
        tableId: TABLE.DRIVER_PROFILES,
        rowId: ride.driver_profile_id,
      });
    } catch {
      driverProfile = null;
    }
  }

  try {
    const transaction = await tablesDB.createTransaction();

    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.RATINGS,
      rowId: ID.unique(),
      data: {
        ride_id: rideId,
        rider_id: ride.rider_id,
        driver_id: ride.driver_id,
        rating,
        comment: sanitisedComment,
        tags: sanitisedTags,
      },
      transactionId: transaction.$id,
    });

    if (driverProfile) {
      const total = Math.max(1, driverProfile.total_rides || 1);
      const current = driverProfile.rating || 5.0;
      const newRating = Math.min(5.0, ((current * (total - 1)) + rating) / total);

      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.DRIVER_PROFILES,
        rowId: driverProfile.$id,
        data: {
          rating: Math.round(newRating * 10) / 10,
        },
        transactionId: transaction.$id,
      });
    }

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
      data: { rating },
      transactionId: transaction.$id,
    });

    await tablesDB.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
    log(`Rating created for ride ${rideId}: ${rating}/5`);
  } catch (e) {
    error(`Failed to create rating: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to save rating' }, 500);
  }

  return res.json({ ok: true, rideId, rating });
};
