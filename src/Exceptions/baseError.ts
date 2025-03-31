/**
 * [BaseError] is the foundation for all custom errors in the application.
 * It extends the built-in [Error] class and adds HTTP status codes and
 * an `isOperational` flag to distinguish between expected and unexpected errors.
 */
class BaseError extends Error {
  public statusCode: number; // HTTP status code associated with the error
  public isOperational: boolean; // Indicates if the error is expected (true) or unexpected (false)

  /**
   * Creates an instance of BaseError.
   * @param {string} message - The error message.
   * @param {number} statusCode - The HTTP status code associated with the error.
   * @param {boolean} isOperational - True if the error is expected (handled gracefully).
   */
  constructor(message: string, statusCode: number, isOperational: boolean) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.name = this.constructor.name; // Sets the error name to the class name

      // Captures a stack trace to help with debugging (excluding the constructor itself)
      Error.captureStackTrace(this, this.constructor);
  }
}

export default BaseError;
