import InvalidIdError from "../Exceptions/Client/InvalidIdError";
import InvalidArgumentsError from "../Exceptions/Client/InvalidArgumentsError";

class CheckNulls {
  public static checkNullUser(userId: bigint | undefined) {
    if (userId == null) {
      throw new InvalidIdError(
        "A required argument is missing of type UserId.  "
      );
    } else {
      return true;
    }
  }
  public static checkNullPage(page: string | string[] | undefined): number {
    InvalidArgumentsError.throwIfNull(page);
    if (Array.isArray(page)) {
      throw new TypeError("Expected a string but a string[] was provided. ");
    } else {
      const pageNumber = Number(page);

      if (!Number.isInteger(pageNumber) || pageNumber < 0) {
        throw new InvalidArgumentsError(
          "Page format is invalid please provide a valid number. "
        );
      }
      return pageNumber;
    }
  }
}
export default CheckNulls;
