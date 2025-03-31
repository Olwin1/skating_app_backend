import ClientError from "./ClientError";

// TODO Add Invalid UserId error for BigInt Conversion failures

/**
 * UserNotFoundError is used for errors caused by the client providing a userId that is invalid / cannot be located in the database.
 * Examples: Invalid input, unauthorised access, missing resources.
 */
class UserNotFoundError extends ClientError {
    static throwIfNull(value: any, message: string) {
        if (!value) throw new UserNotFoundError(message);
    }
    /**
     * Default message for when a target userId cannot be found.  
     */
    public static targetUserMessage = "The target user cannot be matched to an existing userId in the database.  ";

    /**
     * Default message for when the userId ripped from the session token cannot be found.  
     */
    public static selfUserMessage = "The user with the authorised userId cannot be found.";
    /**
     * Creates an instance of UserNotFoundError.
     * @param {string} message - The error message.
     * @param {number} [statusCode=400] - The HTTP status code (defaults to 400).
     */
    constructor(message: string, statusCode: number = 400) {
        super(message, statusCode);
    }
}
export default UserNotFoundError;