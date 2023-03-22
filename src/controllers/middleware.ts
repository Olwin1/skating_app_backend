require("dotenv").config(); // loading env variables
import jwt, { Secret } from "jsonwebtoken";
import User from "../models/User";
import Todo from "../models/Todo";
import { Request, Response, NextFunction, RequestHandler } from "express";
import ReqType from "../typedefs/request";

// CREATE CONTEXT MIDDLEWARE
const createContext: RequestHandler = (req, res, next) => {
  // put any data you want in the object below to be accessible to all routes
  req.context = {
    models: {
      User,
      Todo,
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
        const payload = await jwt.verify(token, process.env.SECRET as Secret);
        if (payload) {
          // store user data in request object
          req.user = payload;
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
  createContext
};