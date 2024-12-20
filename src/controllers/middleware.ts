require("dotenv").config(); // loading env variables
import jwt, { Secret } from "jsonwebtoken";
import { Response, NextFunction, RequestHandler } from "express";
import CustomRequest from "./CustomRequest";
import Geonames from "../models/Geonames";
import Altnames from "../models/Altnames";

// CREATE CONTEXT MIDDLEWARE
const createContext: RequestHandler = (
  req,
  res: Response,
  next: NextFunction
) => {
  (req as CustomRequest).context = {
    models: {
      Geonames,
      Altnames,
    },
  };
  next();
};

// MIDDLEWARE FOR AUTHORIZATION (MAKING SURE THEY ARE LOGGED IN)
const isLoggedIn: RequestHandler = async (req, res, next) => {
  try {
    // check if auth header exists
    if (req.headers.authorization) {
      // parse token from header
      const token = req.headers.authorization.split(" ")[1]; //split the header and get the token
      if (token) {
        const payload = jwt.verify(token, process.env.SECRET as Secret);
        if (payload) {
          // store user data in request object
          (req as CustomRequest).user = payload;
          next();
        } else {
          res.status(400).json({ error: "token verification failed" });
        }
      } else {
        res.status(400).json({ error: "malformed auth header" });
      }
    } else {
      res.status(400).json({ error: "No authorization header" });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
};

// export custom middleware
export default {
  isLoggedIn,
  createContext,
};
