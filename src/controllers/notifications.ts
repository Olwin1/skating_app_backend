import express, { Router, Request, Response } from "express"
import middleware from "./middleware";
import mongoose from "../db/connection";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library



// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const router = Router();
// Endpoint for handling POST requests to '/token'
router.post('/token', middleware.isLoggedIn, async (req: Request, res: Response) => {
  const _id = BigInt((req as CustomRequest).user._id);


  // Start a session with MongoDB

  try {
    // Find the user by their _id using the User model and within the session
    const fcmToken = await prisma.fcm_tokens.upsert({ where: { user_id: _id, token: req.body.fcm_token as string }, create: { token_id: generator.nextId(), user_id: _id, token: req.body.fcm_token }, update: {} });
    return res.json(fcmToken);
  }
  catch (error) {
    // If an error occurs, abort the transaction, end the session, and send an error response
    res.status(400).json({ error });
  }
});

export default router;
