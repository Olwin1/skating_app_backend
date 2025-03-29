import Altnames from "../models/Altnames";
import Geonames from "../models/Geonames";
import User from "User";


declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    userId?: bigint;
    context?: {
      models: {
        Geonames: typeof Geonames;
        Altnames: typeof Altnames;
      };
    };
  }
}
