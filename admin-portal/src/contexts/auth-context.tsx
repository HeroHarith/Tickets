import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [error, setError] = useState<Error | null>(null);

  // Fetch current user data
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        return await apiRequest<User>('GET', '/api/user');
      } catch (error) {
        return null;
      }
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      return await apiRequest<User>('POST', '/api/login', credentials);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<void>('POST', '/api/logout', {});
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}