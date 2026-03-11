const readRequiredEnv = (name: keyof ImportMetaEnv): string | null => {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim();
};

const readOptionalEnv = (name: keyof ImportMetaEnv, fallback: string): string => {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const REQUIRED_APPWRITE_ENV = ['VITE_APPWRITE_ENDPOINT', 'VITE_APPWRITE_PROJECT_ID'] as const satisfies readonly (keyof ImportMetaEnv)[];

export const MISSING_APPWRITE_ENV = REQUIRED_APPWRITE_ENV.filter((name) => readRequiredEnv(name) === null);

export const APPWRITE_CONFIGURED = MISSING_APPWRITE_ENV.length === 0;

export const APPWRITE_ENV = {
  ENDPOINT: readRequiredEnv('VITE_APPWRITE_ENDPOINT') ?? 'https://appwrite.invalid/v1',
  PROJECT_ID: readRequiredEnv('VITE_APPWRITE_PROJECT_ID') ?? 'missing-project-id',
  DB_ID: readRequiredEnv('VITE_APPWRITE_DB_ID') ?? 'missing-db-id',
} as const;

export const APPWRITE_TABLE_ENV = {
  USERS: readRequiredEnv('VITE_APPWRITE_TABLE_USERS') ?? 'users',
  DRIVER_PROFILES: readRequiredEnv('VITE_APPWRITE_TABLE_DRIVER_PROFILES') ?? 'missing-driver-profiles',
  RIDES: readRequiredEnv('VITE_APPWRITE_TABLE_RIDES') ?? 'missing-rides',
  RIDE_OFFERS: readRequiredEnv('VITE_APPWRITE_TABLE_RIDE_OFFERS') ?? 'missing-ride-offers',
  PAYMENTS: readRequiredEnv('VITE_APPWRITE_TABLE_PAYMENTS') ?? 'missing-payments',
  PAYMENT_METHODS: readRequiredEnv('VITE_APPWRITE_TABLE_PAYMENT_METHODS') ?? 'missing-payment-methods',
  EMERGENCY_CONTACTS: readRequiredEnv('VITE_APPWRITE_TABLE_EMERGENCY_CONTACTS') ?? 'missing-emergency-contacts',
  RATINGS: readRequiredEnv('VITE_APPWRITE_TABLE_RATINGS') ?? 'missing-ratings',
  PROMO_CODES: readRequiredEnv('VITE_APPWRITE_TABLE_PROMO_CODES') ?? 'missing-promo-codes',
  SUPPORT_TICKETS: readRequiredEnv('VITE_APPWRITE_TABLE_SUPPORT_TICKETS') ?? 'missing-support-tickets',
} as const;

export const APPWRITE_BUCKET_ENV = {
  AVATARS: readRequiredEnv('VITE_APPWRITE_BUCKET_AVATARS') ?? 'missing-avatars',
  DRIVER_DOCS: readRequiredEnv('VITE_APPWRITE_BUCKET_DRIVER_DOCS') ?? 'missing-driver-docs',
} as const;

export const APPWRITE_FUNCTION_ENV = {
  MATCH_DRIVER: readRequiredEnv('VITE_APPWRITE_FUNCTION_MATCH_DRIVER') ?? 'missing-match-driver',
  DRIVER_TOGGLE: readRequiredEnv('VITE_APPWRITE_FUNCTION_DRIVER_TOGGLE') ?? 'missing-driver-toggle',
  ACCEPT_RIDE: readRequiredEnv('VITE_APPWRITE_FUNCTION_ACCEPT_RIDE') ?? 'missing-accept-ride',
  CREATE_CASH_BOOKING: readRequiredEnv('VITE_APPWRITE_FUNCTION_CREATE_CASH_BOOKING') ?? 'missing-create-cash-booking',
  CREATE_STRIPE_CHECKOUT: readRequiredEnv('VITE_APPWRITE_FUNCTION_CREATE_STRIPE_CHECKOUT') ?? 'missing-create-stripe-checkout',
  COMPLETE_STRIPE_BOOKING: readRequiredEnv('VITE_APPWRITE_FUNCTION_COMPLETE_STRIPE_BOOKING') ?? 'missing-complete-stripe-booking',
  START_TRIP: readRequiredEnv('VITE_APPWRITE_FUNCTION_START_TRIP') ?? 'missing-start-trip',
  END_TRIP: readRequiredEnv('VITE_APPWRITE_FUNCTION_END_TRIP') ?? 'missing-end-trip',
  RAISE_SUPPORT_TICKET: readRequiredEnv('VITE_APPWRITE_FUNCTION_RAISE_SUPPORT_TICKET') ?? 'missing-raise-ticket',
  ADMIN_UPDATE_TICKET: readRequiredEnv('VITE_APPWRITE_FUNCTION_ADMIN_UPDATE_TICKET') ?? 'missing-update-ticket',
  ADMIN_UPDATE_PAYMENT: readRequiredEnv('VITE_APPWRITE_FUNCTION_ADMIN_UPDATE_PAYMENT') ?? 'missing-update-payment',
  SUBMIT_RATING: readRequiredEnv('VITE_APPWRITE_FUNCTION_SUBMIT_RATING') ?? 'missing-submit-rating',
  APPLY_PROMO: readRequiredEnv('VITE_APPWRITE_FUNCTION_APPLY_PROMO') ?? 'missing-apply-promo',
  SEND_SOS: readRequiredEnv('VITE_APPWRITE_FUNCTION_SEND_SOS') ?? 'missing-send-sos',
} as const;

export const ROUTING_ENV = {
  OSRM_BASE_URL: readOptionalEnv('VITE_OSRM_BASE_URL', 'https://router.project-osrm.org'),
} as const;

export const STRIPE_ENV = {
  PUBLISHABLE_KEY: readRequiredEnv('VITE_STRIPE_PUBLISHABLE_KEY') ?? 'missing-stripe-key',
} as const;