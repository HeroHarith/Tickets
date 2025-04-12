/**
 * Standardized API response utilities
 */

/**
 * Generate a successful response
 */
export function successResponse<T>(data: T, code = 200, description = "Success") {
  return {
    code,
    success: true,
    data,
    description
  };
}

/**
 * Generate an error response
 */
export function errorResponse(description: string, code = 400, data: any = null) {
  return {
    code,
    success: false,
    data,
    description
  };
}