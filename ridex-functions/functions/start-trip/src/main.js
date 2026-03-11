import { Client, TablesDB } from 'node-appwrite';

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

  const { rideId, driverId } = body;
  if (!rideId || !driverId) {
    return res.json({ ok: false, message: 'rideId and driverId are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== driverId) {
    return res.json({ ok: false, message: 'Unauthorized trip start request' }, 403);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  try {
    const ride = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
    });

    if (ride.driver_id !== driverId) {
      return res.json({ ok: false, message: 'Not assigned to this ride' }, 403);
    }

    if (!['driver_assigned', 'driver_arriving'].includes(ride.status)) {
      return res.json({ ok: false, message: `Ride cannot be started from status: ${ride.status}` }, 409);
    }

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
      data: {
        status: 'in_progress',
        started_at: new Date().toISOString(),
      },
    });

    return res.json({ ok: true, rideId, status: 'in_progress' });
  } catch (e) {
    error(`Failed to start trip: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to start trip' }, 500);
  }
};