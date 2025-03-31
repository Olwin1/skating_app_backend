import BaseError from "../baseError";

/**
 * ServerError is used for internal server errors (5xx HTTP errors).
 * These represent unexpected issues that occur on the backend.
 */
class ServerError extends BaseError {
    /**
     * Creates an instance of ServerError.
     * @param {string} message - The error message.
     * @param {number} [statusCode=500] - The HTTP status code (defaults to 500).
     */
    constructor(message: string, statusCode: number = 500) {
        super(message, statusCode, false); // 'false' indicates an unexpected error
    }
}

export default ServerError;
