import { Client, TablesDB, ID, Query } from 'node-appwrite';

const ACTIVE_STATUSES = new Set(['searching', 'driver_assigned', 'driver_arriving', 'in_progress']);

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
    EMERGENCY_CONTACTS: process.env.APPWRITE_TABLE_EMERGENCY_CONTACTS,
    RIDES: process.env.APPWRITE_TABLE_RIDES,
    SUPPORT_TICKETS: process.env.APPWRITE_TABLE_SUPPORT_TICKETS,
  };
  const webhookUrl = process.env.SOS_WEBHOOK_URL || null;

  if (req.method !== 'POST') {
    return res.json({ ok: false, message: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const { rideId, lat, lng } = body;

  if (!rideId) {
    return res.json({ ok: false, message: 'rideId is required' }, 400);
  }

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId) {
    return res.json({ ok: false, message: 'Authentication required' }, 403);
  }

  // Validate coordinates if provided
  const sosLat = typeof lat === 'number' && lat >= -90 && lat <= 90 ? lat : null;
  const sosLng = typeof lng === 'number' && lng >= -180 && lng <= 180 ? lng : null;

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const tablesDB = new TablesDB(client);

  let ride;
  let contacts = [];
  try {
    ride = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      rowId: rideId,
    });

    const contactsResult = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.EMERGENCY_CONTACTS,
      queries: [
        Query.equal('user_id', ride.rider_id),
        Query.equal('notify_on_sos', true),
        Query.limit(25),
      ],
    });
    contacts = contactsResult.rows;
  } catch (e) {
    error(`SOS: Ride not found: ${rideId}`);
    return res.json({ ok: false, message: 'Ride not found' }, 404);
  }

  if (ride.rider_id !== callerUserId) {
    return res.json({ ok: false, message: 'Only the rider can trigger SOS for this ride' }, 403);
  }

  if (!ACTIVE_STATUSES.has(ride.status)) {
    log(`SOS fired on non-active ride ${rideId} (status: ${ride.status}) — still logging`);
  }

  const locationStr = sosLat !== null
    ? `${sosLat.toFixed(6)}, ${sosLng.toFixed(6)}`
    : 'Unknown';

  const message = [
    `🚨 SOS ALERT — ${new Date().toISOString()}`,
    `Ride ID: ${rideId}`,
    `Rider ID: ${ride.rider_id}`,
    `Driver ID: ${ride.driver_id || 'Not assigned'}`,
    `Status: ${ride.status}`,
    `Pickup: ${ride.pickup_address}`,
    `Dropoff: ${ride.dropoff_address}`,
    `SOS Location: ${locationStr}`,
    `Vehicle type: ${ride.vehicle_type}`,
    `Emergency contacts on file: ${contacts.length}`,
  ].join('\n');

  let ticketId;
  let contactsNotified = 0;
  try {
    ticketId = ID.unique();
    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: TABLE.SUPPORT_TICKETS,
      rowId: ticketId,
      data: {
        user_id: ride.rider_id,
        ride_id: rideId,
        type: 'sos',
        subject: `SOS Alert — Ride ${rideId}`,
        message,
        status: 'open',
        severity: 'critical',
        lat: sosLat,
        lng: sosLng,
        driver_id: ride.driver_id || null,
        assigned_to: null,
        resolved_at: null,
      },
    });
    log(`SOS ticket created: ${ticketId} for ride ${rideId}`);

    if (webhookUrl) {
      const notificationResults = await Promise.all(contacts.map(async (contact) => {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              type: 'ridex.sos',
              ticketId,
              rideId,
              riderId: ride.rider_id,
              driverId: ride.driver_id || null,
              contact,
              location: {
                lat: sosLat,
                lng: sosLng,
              },
              message,
            }),
          });

          return response.ok;
        } catch {
          return false;
        }
      }));

      contactsNotified = notificationResults.filter(Boolean).length;
    }
  } catch (e) {
    error(`Failed to create SOS ticket for ride ${rideId}: ${e.message}`);
    return res.json({ ok: false, message: 'Failed to log SOS alert' }, 500);
  }

  return res.json({
    ok: true,
    rideId,
    ticketId,
    contactsNotified,
    message: webhookUrl
      ? 'SOS alert logged and outbound emergency notifications were attempted.'
      : 'SOS alert logged. Configure SOS_WEBHOOK_URL to notify emergency contacts automatically.',
  });
};
