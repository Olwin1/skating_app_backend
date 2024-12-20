import { Request } from "express";

interface ReqType extends Request {
  context: any;
}
export default ReqType;
