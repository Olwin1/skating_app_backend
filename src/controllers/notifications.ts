import express, { Router, Request, Response } from "express"
import middleware from "./middleware";
import mongoose from "../db/connection";
import CustomRequest from "./CustomRequest";

const router = Router();

// Endpoint for handling POST requests to '/token'
router.post('/token', middleware.isLoggedIn, async (req: Request, res: Response) => {
  const { _id } = (req as CustomRequest).user;

  const { User } = (req as CustomRequest).context.models;

  // Start a session with MongoDB
  const session = await mongoose.startSession();

  session.startTransaction();
  try {
    // Find the user by their _id using the User model and within the session
    const user = await User.findOne({ "_id": _id }).session(session)

    const fcmToken = req.body.fcm_token as string;
    const tokens = user["fcm_token"] as string[];

    if (user["fcm_token"]) {
      // Check if the fcmToken is already present in the user's tokens
      if (tokens.includes(fcmToken)) {
        session.endSession();
        return res.json({ "message": "token already saved" })

      }
      else {
        let retval;

        // Update the user by pushing the new fcmToken to the fcm_token array
        retval = await User.updateOne(
          { "_id": _id },
          { $push: { "fcm_token": fcmToken } }
        ).session(session);

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        return res.json(retval);
      }
    }
  } catch (error) {
    // If an error occurs, abort the transaction, end the session, and send an error response
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({ error });
  }
});

export default router;
