/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  data: T | null;
  description: string;
}

/**
 * Create a successful API response
 * 
 * @param data The data to include in the response
 * @param code HTTP status code (defaults to 200)
 * @param description Success message
 * @returns Formatted API response
 */
export function successResponse<T>(data: T, code = 200, description = 'Operation successful'): ApiResponse<T> {
  return {
    code,
    success: true,
    data,
    description
  };
}

/**
 * Create an error API response
 * 
 * @param description Error message
 * @param code HTTP status code (defaults to 400)
 * @param data Optional data to include with the error
 * @returns Formatted API response
 */
export function errorResponse(description: string, code = 400, data: any = null): ApiResponse {
  return {
    code,
    success: false,
    data,
    description
  };
}

/**
 * Middleware to standardize Express error responses
 */
export function standardErrorHandler(err: any, req: any, res: any, next: any) {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Internal Server Error';
  
  res.status(statusCode).json(errorResponse(errorMessage, statusCode));
}