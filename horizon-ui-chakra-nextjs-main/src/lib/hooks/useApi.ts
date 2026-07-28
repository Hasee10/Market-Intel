'use client';

import { useCallback, useEffect, useState } from 'react';

import { IApiResponse } from '@/types/api-response';

// Lightweight replacement for Mantine's `useFetch`, used across the ported
// pages. Returns the same { data, loading, error, refetch } shape so page
// code (largely ported from the Mantine app) doesn't need to change.
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        const json = await res.json();
        if (!cancelled) setData(json as T);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce]);

  return { data, loading, error, refetch };
}

export function useCustomers() {
  return useFetch<IApiResponse<any[]>>('/api/customers');
}

export function useProfile() {
  return useFetch<IApiResponse<any>>('/api/profile');
}
