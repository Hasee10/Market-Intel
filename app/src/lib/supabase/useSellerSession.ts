'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type SellerSession = {
  email: string | null;
  businessName: string | null;
  loading: boolean;
};

// Client-side hook for header/nav bits that need "who's logged in right
// now" without a server round trip. Reads auth metadata set at signup
// (see auth/signup/page.tsx) rather than querying the sellers table, so it
// stays cheap enough to call from the header on every page.
export function useSellerSession(): SellerSession {
  const [session, setSession] = useState<SellerSession>({
    email: null,
    businessName: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    const applyUser = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      setSession({
        email: user?.email ?? null,
        businessName: (user?.user_metadata?.business_name as string) ?? null,
        loading: false,
      });
    };

    supabase.auth.getUser().then(({ data }) => applyUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      applyUser(sessionData?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return session;
}
