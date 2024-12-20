import { Request } from "express";
interface CustomRequest extends Request {
  context: any;
  user: any;
}
export default CustomRequest;
