import { Request } from 'express';
import User from 'User';
import Geonames from '../models/Geonames';
import Altnames from '../models/Altnames';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: bigint;
      context?: {
        models: {
          Geonames: typeof Geonames;
          Altnames: typeof Altnames;
        };
      };
      file?: Express.Multer.File;  // Replace with a more specific type if you're using file upload libraries like Multer
    }
  }
}
