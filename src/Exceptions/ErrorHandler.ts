import { Response } from "express";
import BaseError from "./baseError";
import Logger from "../utils/logging"; // Example: Use Winston or another logger

/**
 * [ErrorHandler] is a generic class used to handle errors during HTTP Requests.
 */
class ErrorHandler {
    /**
     * Simple error handler to return an error back to the client and output it to the console.  
     * @param {BaseError} err - The error. 
     * @param {Response} res  - The response instance.  
     */
  public static handleError(err: BaseError, res: Response) {
    // Alert monitoring system if it's an unexpected error
    if (!err.isOperational) {
      // Send alert to monitoring system (e.g., Sentry, Datadog)
      Logger.instance.logger.error(
        `Unexpected Error: [${err.name}] ${err.message}`
      );
    } else {
      Logger.instance.logger.warn(`[${err.name}] ${err.message}`);
    }

    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
  }
}
export default ErrorHandler;
