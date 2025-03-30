import { Router } from "express";

import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import CheckNulls from "../utils/checkNulls";
import RouteBuilder from "../utils/RouteBuilder";

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
  ...RouteBuilder.createRouteHandler(async (req, res) => {
      // Extract the user's req.userId from the request
      CheckNulls.checkNullUser(req.userId);

      // Try to upsert an FCM token record in the database
      const fcmToken = await prisma.fcm_tokens.upsert({
        where: { user_id: req.userId, token: req.body.fcm_token as string },
        create: {
          token_id: generator.nextId(),
          user_id: req.userId!,
          token: req.body.fcm_token,
        },
        update: {}, // This is empty because it's an upsert operation
      });

      // Send a JSON response with the upserted FCM token
      return res.json(fcmToken);
  }
));

export default router;
