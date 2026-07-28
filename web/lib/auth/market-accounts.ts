import 'server-only';

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;

export type MarketAccount = {
  id: string;
  email: string;
  companyName: string;
  planTier: string;
};

export class MarketAccountAuthError extends Error {
  constructor(
    message: string,
    public code: 'invalid_email' | 'weak_password' | 'email_taken' | 'invalid_credentials' | 'db_unavailable'
  ) {
    super(message);
    this.name = 'MarketAccountAuthError';
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new MarketAccountAuthError(
      'Database is not configured on this deployment.',
      'db_unavailable'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function rowToMarketAccount(row: Record<string, unknown>): MarketAccount {
  return {
    id: row.id as string,
    email: row.email as string,
    companyName: row.company_name as string,
    planTier: row.plan_tier as string,
  };
}

export async function createMarketAccount(
  email: string,
  password: string,
  companyName: string
): Promise<MarketAccount> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new MarketAccountAuthError('Enter a valid email address.', 'invalid_email');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new MarketAccountAuthError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      'weak_password'
    );
  }
  if (!companyName.trim()) {
    throw new MarketAccountAuthError('Company name is required.', 'invalid_credentials');
  }

  const supabase = getAdminClient();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  const { data, error } = await supabase
    .from('market_accounts')
    .insert({
      email: normalizedEmail,
      password_hash: passwordHash,
      company_name: companyName.trim(),
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new MarketAccountAuthError(
        'An account with this email already exists.',
        'email_taken'
      );
    }
    throw error;
  }

  return rowToMarketAccount(data);
}

export async function verifyMarketAnalystCredentials(
  email: string,
  password: string
): Promise<MarketAccount | null> {
  const supabase = getAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data } = await supabase
    .from('market_accounts')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!data) {
    await bcrypt.compare(password, '$2a$12$' + 'a'.repeat(53));
    return null;
  }

  const valid = await bcrypt.compare(password, data.password_hash as string);
  if (!valid) return null;

  return rowToMarketAccount(data);
}

export async function getMarketAccountById(id: string): Promise<MarketAccount | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('market_accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToMarketAccount(data) : null;
}
