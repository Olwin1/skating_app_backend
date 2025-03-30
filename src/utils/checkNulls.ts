import NullPageException from "../Exceptions/NullPageException";
import NullUserException from "../Exceptions/NullUserException";

class CheckNulls {
    public static checkNullUser(userId: bigint | undefined) {
        if(userId == null){
            throw new NullUserException("req.userId cannot be null");
          } else {
            return true;
          }
    }
    public static checkNullPage(page: string | string[] | undefined) {
        if(page == null){
            throw new NullPageException("A page parameter must be provided to this route. ");
          } else if (Array.isArray(page)) {
            throw new TypeError("Expected a string but a string[] was provided. ")
          } else {
            return Number.parseInt(page);
          }
    }
}
export default CheckNulls;