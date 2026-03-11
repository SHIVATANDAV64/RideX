import { Client, Account, TablesDB, Storage, Functions } from 'appwrite';
import { APPWRITE_BUCKET_ENV, APPWRITE_ENV, APPWRITE_FUNCTION_ENV, APPWRITE_TABLE_ENV } from './env';

const ENDPOINT = APPWRITE_ENV.ENDPOINT;
const PROJECT_ID = APPWRITE_ENV.PROJECT_ID;

export const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID);

export const account   = new Account(client);
export const tablesDB  = new TablesDB(client);
export const storage   = new Storage(client);
export const functions = new Functions(client);

// ── IDs ──────────────────────────────────────────────────────────────────────
export const DB_ID = APPWRITE_ENV.DB_ID;

export const TABLE = APPWRITE_TABLE_ENV;

export const BUCKET = APPWRITE_BUCKET_ENV;

export const FN = APPWRITE_FUNCTION_ENV;
