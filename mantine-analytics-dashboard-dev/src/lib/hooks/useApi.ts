import { useFetch } from '@mantine/hooks';
import type { IApiResponse } from '@/types/api-response';
import type { CustomerDto } from '@/types';

export type ApiResponse<T> = IApiResponse<T>;

// Generic hook for GET requests
export function useApiGet<T>(endpoint: string) {
  return useFetch<ApiResponse<T>>(endpoint);
}

// Hook for customers
export function useCustomers() {
  return useApiGet<CustomerDto[]>('/api/customers');
}

// Hook for profile
export function useProfile() {
  return useApiGet<any>('/api/profile');
}
