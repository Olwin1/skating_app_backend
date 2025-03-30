// // src/types/express/index.d.ts

import Altnames from "../../models/Altnames";
import Geonames from "../../models/Geonames";
import User from "../User";
// // to make the file a module and avoid the TypeScript error
// export {}
import {Request } from "express";

interface CustomRequest extends Request {
    user?: User;
    userId?: bigint;
    context?: {
      models: {
        Geonames: typeof Geonames;
        Altnames: typeof Altnames;
      };
    };
    file?: Express.Multer.File;
  }