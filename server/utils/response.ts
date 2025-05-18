/**
 * Standard response format for API responses
 */

interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T | null;
  description: string;
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T | null,
  code: number = 200,
  description: string = 'Operation successful'
): ApiResponse<T> {
  return {
    code,
    success: true,
    data,
    description
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  description: string = 'An error occurred',
  code: number = 500
): ApiResponse<null> {
  return {
    code,
    success: false,
    data: null,
    description
  };
}