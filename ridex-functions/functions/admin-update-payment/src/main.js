import { Client, Query, TablesDB } from 'node-appwrite';

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
    PAYMENTS: process.env.APPWRITE_TABLE_PAYMENTS,
    RIDES: process.env.APPWRITE_TABLE_RIDES,
    USERS: process.env.APPWRITE_TABLE_USERS,
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

  const { paymentId, status, receiptUrl = null } = body;
  if (!paymentId || !status) {
    return res.json({ ok: false, message: 'paymentId and status are required' }, 400);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const tablesDB = new TablesDB(client);

  const callerUserId = getHeader(req, 'x-appwrite-user-id');
  if (!callerUserId) {
    return res.json({ ok: false, message: 'Authentication required' }, 403);
  }

  try {
    const admins = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: TABLE.USERS,
      queries: [
        Query.equal('user_id', callerUserId),
        Query.equal('role', 'admin'),
        Query.limit(1),
      ],
    });
    if (admins.total === 0) {
      return res.json({ ok: false, message: 'Admin access required' }, 403);
    }

    const payment = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: TABLE.PAYMENTS,
      rowId: paymentId,
    });

    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: TABLE.PAYMENTS,
      rowId: paymentId,
      data: {
        status,
        receipt_url: receiptUrl,
      },
    });

    if (payment.ride_id) {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        rowId: payment.ride_id,
        data: {
          payment_status: status === 'paid' ? 'paid' : status === 'refunded' ? 'refunded' : 'pending',
        },
      });
    }

    return res.json({ ok: true, paymentId, status });
  } catch (err) {
    error(`Failed to update payment: ${err.message}`);
    return res.json({ ok: false, message: 'Could not update payment' }, 500);
  }
};