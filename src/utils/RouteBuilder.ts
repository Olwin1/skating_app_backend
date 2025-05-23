import { NextFunction, Response } from "express";
import { CustomRequest } from "express-override";
import CheckNulls from "./checkNulls";

// Import authentication middleware
import middleware from "../controllers/middleware";
import BaseError from "../Exceptions/baseError";
import ErrorHandler from "../Exceptions/ErrorHandler";
import Logger from "./logging";

/**
 * RouteBuilder: A utility class for constructing Express route handlers with common behaviors.
 *
 * This class simplifies route creation by:
 * - Automatically applying authentication (`middleware.isLoggedIn`).
 * - Ensuring the user ID is valid (`CheckNulls.checkNullUser`).
 * - Wrapping handlers with standardised error handling.
 * - Reducing repetitive middleware and error-checking logic in routes.
 */
class RouteBuilder {
  /**
   * Creates an Express route handler with authentication, validation, and error handling.
   *
   * @param handler - An asynchronous function that processes the request and sends a response.
   *
   * @returns An Express-compatible middleware array that includes:
   *   1. `middleware.isLoggedIn` - Ensures the user is authenticated before proceeding.
   *   2. A wrapped handler function that performs validation and error handling.
   *
   * @example
   * // Define a route without manually adding authentication and try-catch blocks.
   * router.post("/post", ...RouteBuilder.createRouteHandler(async (req, res) => {
   *   const post = await prisma.posts.create({ data: { ... } });
   * }));
   */
  public static createRouteHandler(
    handler: (
      req: CustomRequest,
      res: Response
    ) => Promise<Response<any, Record<string, any>> | undefined | void>
  ) {
    return [
      /**
       * Middleware: Ensure the user is logged in before handling the request.
       * If the user is not authenticated, `middleware.isLoggedIn` will terminate the request.
       */
      middleware.isLoggedIn,

      /**
       * Middleware: Validate user ID and execute the request handler with error handling.
       */
      async (req: CustomRequest, res: Response, _next: NextFunction) => {
        try {
          // Ensure that the authenticated user has a valid user ID.
          CheckNulls.checkNullUser(req.userId);

          // Execute the provided route handler function.
          await handler(req, res);
        } catch (error) {
          if (!(error instanceof Error)) {
            Logger.instance.logger.error(`Error in Error Logging: ${error}`);
            return res.status(500).json({ error: error });
          }

          if (error instanceof BaseError) {
            // Handle any unexpected errors and respond with a 400 status.
            return ErrorHandler.handleError(error, res);
          } else {
            Logger.instance.logger.error(`Unexpected Unhandled Error: [${error.name}] ${error.message}`)
            return res.status(500).json({error: error});
          }
        }
      },
    ];
  }
}

export default RouteBuilder;
