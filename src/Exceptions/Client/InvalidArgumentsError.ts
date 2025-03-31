import ClientError from "./ClientError";

/**
 * InvalidArgumentsError is used for errors caused by the client providing any sort of arguments that are invalid be that forgetting a page argument in a specific query or a malformed userId argument.
 * Examples: page: "greenBin", userId: 32, etc...
 */
class InvalidArgumentsError extends ClientError {
  static throwIfNull(value: any, message: string) {
    if (!value) throw new InvalidArgumentsError(this.default + message);
  }
  /**
   * Default message for when a argument is missing.
   */
  private static default =
    "The request is missing an expected argument or it was provided in an unexpected format: ";

  /**
   * Creates an instance of UserNotFoundError.
   * @param {string} message - The error message.
   * @param {number} [statusCode=400] - The HTTP status code (defaults to 400).
   */
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode);
  }
}
export default InvalidArgumentsError;
