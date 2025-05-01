import InvalidArgumentsError from "./InvalidArgumentsError";

/**
 * InvalidIdError is used for errors caused by the client providing a malformed userId argument.
 * Examples: user: false, user: "cows", user: "-4"
 */
class InvalidIdError extends InvalidArgumentsError {
  /**
   *
   * @param sId - The string version of the id (does't have to be a string but if not will throw an [InvalidIdError] error)
   */
  static convertToBigInt(sId: any, requestUserId: bigint | undefined = undefined): bigint {
    try {
      const userId = BigInt(sId);
      if (userId <= 1) {
        if(requestUserId && userId == BigInt(0)) {
          return requestUserId;
        }
        throw new InvalidIdError(sId);
      } else {
        return userId;
      }
    } catch (e) {
      throw new InvalidIdError(sId);
    }
  }

  /**
   * Creates an instance of UserNotFoundError.
   * @param {string} message - The error message.
   * @param {number} [statusCode=400] - The HTTP status code (defaults to 400).
   */
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode);
  }
}
export default InvalidIdError;
