import { Client, ID, TablesDB } from 'node-appwrite';

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
    SUPPORT_TICKETS: process.env.APPWRITE_TABLE_SUPPORT_TICKETS,
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

  const { userId, rideId = null, type = 'general', severity = 'medium', subject, message, driverId = null } = body;
  if (!userId || !subject || !message) {
    return res.json({ ok: false, message: 'userId, subject, and message are required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId || callerUserId !== userId) {
    return res.json({ ok: false, message: 'Unauthorized support ticket request' }, 403);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const tablesDB = new TablesDB(client);

  try {
    const ticketId = ID.unique();
    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.SUPPORT_TICKETS,
      rowId: ticketId,
      data: {
        user_id: userId,
        ride_id: rideId,
        type,
        subject: String(subject).slice(0, 256),
        message: String(message).slice(0, 4000),
        status: 'open',
        severity,
        lat: null,
        lng: null,
        driver_id: driverId,
        assigned_to: null,
        resolved_at: null,
      },
    });
    return res.json({ ok: true, ticketId });
  } catch (err) {
    error(`Failed to raise support ticket: ${err.message}`);
    return res.json({ ok: false, message: 'Could not raise support ticket' }, 500);
  }
};