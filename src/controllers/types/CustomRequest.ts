import { Request } from "express";
import User from "./User";
interface CustomRequest extends Request {
  context: any;
  user: User;
  userId: bigint;
}
export default CustomRequest;
