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
    const userId = req.userId;
    const newToken = req.body.fcm_token as string;

    CheckNulls.checkNullUser(req.userId);

    // Get all tokens for this user
    const existingTokens = await prisma.fcm_tokens.findMany({
      where: { user_id: userId! },
      orderBy: { updated_at: "asc" }, // or 'updated_at'
    });

    // If user already has 5 tokens and it's a new token
    if (
      existingTokens.length >= 5 &&
      !existingTokens.some((t) => t.token === newToken)
    ) {
      const tokenToDelete = existingTokens[0]; // Least recently added/used
      await prisma.fcm_tokens.delete({
        where: { token: tokenToDelete.token },
      });
    }

    // Upsert the new or existing token
    const fcmToken = await prisma.fcm_tokens.upsert({
      where: { token: newToken },
      create: {
        token_id: generator.nextId(),
        user_id: userId!,
        token: newToken,
      },
      update: {
        user_id: userId!,
        updated_at: new Date(),
        // or updated_at
      },
    });

    // Send a JSON response with the upserted FCM token
    return res.json(fcmToken);
  })
);

export default router;
