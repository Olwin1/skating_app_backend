import ClientError from "./ClientError";

/**
 * UserBlockedError is used for errors caused by either the target user blocking the user or the user blocking the target user.  
 * Examples: Follow requests, Messages, etc... may raise this error when a block is identified.  
 */
class UserBlockedError extends ClientError {
    static throwIfBlocked(value: boolean, message: string = this.targetUserMessage) {
        if (value) throw new UserBlockedError(message);
    }
    /**
     * Default message for when a target userId cannot be found.  
     */
    public static targetUserMessage = "Either the user has blocked the target or been blocked by the target. ";

    /**
     * Creates an instance of UserBlockedError.
     * @param {string} message - The error message.
     * @param {number} [statusCode=400] - The HTTP status code (defaults to 403).
     */
    constructor(message: string, statusCode: number = 403) {
        super(message, statusCode);
    }
}
export default UserBlockedError;