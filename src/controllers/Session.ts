// Import required modules
require("dotenv").config();
import { Router } from "express";

import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import RouteBuilder from "../utils/RouteBuilder";

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// Create a new router instance
const router = Router();

// POST endpoint for creating a new session
router.post("/session", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Create a new session in the database
    const session = await prisma.sessions.create({
      data: {
        // Generate a session ID using the "generator.nextId()" function
        session_id: generator.nextId(),
        name: req.body.name,
        description: req.body.description,
        //images: images,
        //type: req.body.type,
        share: true, //req.body.share,
        start_timestamp: new Date(req.body.start_time).toISOString(),
        end_timestamp: new Date(req.body.end_time).toISOString(),
        distance: parseFloat(req.body.distance),
        //latitude: req.body.latitude,
        //longitude: req.body.longitude,
        author_id: req.userId!, // Set the author ID to the user's ID
      },
    });
    // Respond with a success message
    res.json({ success: true });
}));

// GET endpoint for retrieving a specific session
router.get("/session", ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Retrieve a session from the database using the session ID from the request headers
    const session = await prisma.sessions.findUnique({
      where: { session_id: BigInt(req.headers.session as string) },
    });
    // Respond with the retrieved session
    res.json(session);
}));

// GET endpoint for retrieving a list of sessions for the user's friends
router.get("/sessions", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Calculate a cutoff date (24 hours ago)
    let cutoffDate = new Date(
      new Date().getTime() - 24 * 60 * 60 * 1000
    ).toISOString();

    // Retrieve sessions from the database where the author ID is a friend of the user
    const sessions = await prisma.$queryRaw`
        SELECT
        "session_id",
        "name",
        "type",
        "share",
        "author_id"
        FROM "sessions"
        WHERE "author_id" IN (
            SELECT "user1_id" FROM "friends" WHERE "user2_id" = ${req.userId}
            UNION
            SELECT "user2_id" FROM "friends" WHERE "user1_id" = ${req.userId}
        )
        AND "end_timestamp" > ${cutoffDate}::timestamp
        AND "author_id" NOT IN (
            SELECT "blocked_user_id" FROM "blocked_users" WHERE "blocking_user_id" = ${req.userId}
            UNION
            SELECT "blocking_user_id" FROM "blocked_users" WHERE "blocked_user_id" = ${req.userId}
        );
      `;

    // Respond with the retrieved sessions
    res.json(sessions);
}));

// Export the router for use in other files
export default router;
