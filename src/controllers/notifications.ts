import express, { Router, Request, Response } from "express";
import middleware from "./middleware";
import mongoose from "../db/connection";
import CustomRequest from "./types/CustomRequest";
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const router = Router();

// This is an HTTP POST request handler for the '/token' endpoint
router.post(
  "/token",
  middleware.isLoggedIn,
  async (req: Request, res: Response) => {
    try {
      // Extract the user's _id from the request
      const _id = BigInt((req as CustomRequest).user._id);

      // Try to upsert an FCM token record in the database
      const fcmToken = await prisma.fcm_tokens.upsert({
        where: { user_id: _id, token: req.body.fcm_token as string },
        create: {
          token_id: generator.nextId(),
          user_id: _id,
          token: req.body.fcm_token,
        },
        update: {}, // This is empty because it's an upsert operation
      });

      // Send a JSON response with the upserted FCM token
      return res.json(fcmToken);
    } catch (error) {
      // If an error occurs, send a JSON response with a 400 Bad Request status and the error message
      res.status(400).json({ error });
    }
  }
);

export default router;
