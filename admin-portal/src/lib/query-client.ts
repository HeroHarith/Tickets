import { QueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type QueryFnOptions = {
  on401?: 'redirect' | 'returnNull';
};

// Create a default fetch function for React Query
export function getQueryFn<T>(options: QueryFnOptions = {}) {
  return async ({ queryKey }: { queryKey: string[] }): Promise<T> => {
    try {
      const [url, ...params] = queryKey;
      const queryString = params.length ? `?${new URLSearchParams(Object.fromEntries(params.map(param => param.split('=')))).toString()}` : '';
      return await apiRequest<T>('GET', `${url}${queryString}`);
    } catch (error: any) {
      if (error.response?.status === 401 && options.on401 === 'returnNull') {
        return null as any;
      }
      throw error;
    }
  };
}