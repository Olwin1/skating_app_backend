import express, { Router, Request, Response } from "express" // import router from express
import middleware from "./middleware";
import mongoose from "../db/connection";
import CustomRequest from "./CustomRequest";

const router = Router();
const hit = (num: number) => {
  const vra = "dayum that is a higt" + num.toString()
  console.log(vra)
}
router.post('/token', middleware.isLoggedIn, async (req: Request, res: Response) => {
  const { _id } = (req as CustomRequest).user;
  // Get the User and Post models from the request context
  const { User } = (req as CustomRequest).context.models;
  // Start a new MongoDB session
  const session = await mongoose.startSession();
  // Start a transaction within the session
  session.startTransaction();
  try {
    const user = await User.findOne({ "_id": _id }).session(session)
    //const deviceId = req.body.device_id as string;
    const fcmToken = req.body.fcm_token as string;
    const tokens = user["fcm_token"] as string[]
    hit(1)
    if (user["fcm_token"]) {
      if (tokens.includes(fcmToken)) {
        hit(2)

        return res.json({ "message": "token already saved" })
      }
      else {
        hit(3)
        let retval;
        //if (!user["fcm_tokens"]) {
        retval = await User.updateOne(
          { "_id": _id },
          { $push: { "fcm_token": fcmToken } }
        ).session(session);
        // } else {
        //   const fcmTokens: { [key: string]: string } = user["fcm_tokens"] as { [key: string]: string };
        //   fcmTokens[deviceId] = fcmToken


        //   retval = await User.updateOne(
        //     { "_id": _id },
        //     { $set: { "fcm_tokens": { deviceId: fcmToken } } }
        //   ).session(session);

        // }
        // Add the new post's ID to the user's "posts" array

        // If everything is successful, commit the transaction
        await session.commitTransaction();
        // End the session
        session.endSession();
        // Return the new post as a JSON response
        return res.json(retval);
      }
    }
    else {
      hit(4)
    }
  } catch (error) {
    // If there is an error, abort the transaction
    await session.abortTransaction();
    // End the session
    session.endSession();
    // Return an error response
    res.status(400).json({ error });
  }
});


export default router;
