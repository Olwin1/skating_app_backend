import BaseError from "../baseError";


/**
 * ClientError is used for errors caused by the client (4xx HTTP errors).
 * Examples: Invalid input, unauthorised access, missing resources.
 */
class ClientError extends BaseError {
    /**
     * Creates an instance of ClientError.
     * @param {string} message - The error message.
     * @param {number} [statusCode=400] - The HTTP status code (defaults to 400).
     */
    constructor(message: string, statusCode: number = 400) {
        super(message, statusCode, true); // 'true' indicates this is an expected error
    }
}

export default ClientError;
