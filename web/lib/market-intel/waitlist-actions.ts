import 'server-only';

import { createClient } from '@supabase/supabase-js';

export class WaitlistError extends Error {
  constructor(
    message: string,
    public code: 'invalid_email' | 'already_joined' | 'db_unavailable'
  ) {
    super(message);
    this.name = 'WaitlistError';
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new WaitlistError('Database is not configured on this deployment.', 'db_unavailable');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function joinMarketIntelWaitlist(
  email: string,
  companyName: string | null
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new WaitlistError('Enter a valid email address.', 'invalid_email');
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from('market_intel_waitlist').insert({
    email: normalizedEmail,
    company_name: companyName?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') {
      // Already on the list - treat as success rather than an error, so
      // re-submitting the same email isn't a confusing dead end.
      return;
    }
    throw error;
  }
}
