import { Client, TablesDB, Query } from 'node-appwrite';

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
    DRIVER_PROFILES: process.env.APPWRITE_TABLE_DRIVER_PROFILES,
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

  const { driverId, online, lat = null, lng = null } = body;
  if (!driverId || typeof online !== 'boolean') {
    return res.json({ ok: false, message: 'driverId and online are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== driverId) {
    return res.json({ ok: false, message: 'Unauthorized driver toggle request' }, 403);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  try {
    const profiles = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      queries: [Query.equal('user_id', driverId), Query.limit(1)],
    });

    const profile = profiles.rows[0];
    if (!profile) {
      return res.json({ ok: false, message: 'Driver profile not found' }, 404);
    }

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      rowId: profile.$id,
      data: {
        is_online: online,
        ...(typeof lat === 'number' ? { current_lat: lat } : {}),
        ...(typeof lng === 'number' ? { current_lng: lng } : {}),
      },
    });

    return res.json({ ok: true, driverId, online });
  } catch (e) {
    error(`Failed to update availability: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to update availability' }, 500);
  }
};