# RideX Frontend

React + TypeScript + Vite frontend for RideX.

## Environment Setup

Copy `.env.example` to `.env` and set the deployed Appwrite values the frontend must call.

Required:

- `VITE_APPWRITE_ENDPOINT`
- `VITE_APPWRITE_PROJECT_ID`

Configurable IDs shared with the backend deployment:

- `VITE_APPWRITE_DB_ID`
- `VITE_APPWRITE_TABLE_*`
- `VITE_APPWRITE_BUCKET_*`
- `VITE_APPWRITE_FUNCTION_*`

Routing provider:

- `VITE_OSRM_BASE_URL`

The frontend now resolves all Appwrite database, table, bucket, and function identifiers from env-backed config so it can stay aligned with `ridex-functions/.env.example` and `ridex-functions/appwrite.json`.
