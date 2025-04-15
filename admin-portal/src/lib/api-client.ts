import axios from 'axios';

// Create an axios instance with default config
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for sending cookies with cross-origin requests
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle session expiration
    if (error.response?.status === 401) {
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T;
  description?: string;
}

// API request function
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any
): Promise<T> {
  try {
    const response = await apiClient({ method, url, data });
    
    // Check if the response follows our API response structure
    const responseData = response.data as ApiResponse<T>;
    
    if (responseData && typeof responseData.success === 'boolean') {
      if (!responseData.success) {
        throw new Error(responseData.description || 'API request failed');
      }
      return responseData.data;
    }
    
    // If the response doesn't follow our structure, return as is
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}