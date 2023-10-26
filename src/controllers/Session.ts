// Import required modules
require("dotenv").config();
import { Router } from "express"
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library




// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});

// Create a new router instance
const router = Router();

// Define a route for creating a new session
router.post("/session", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);
    try {
        //let images = JSON.parse(req.body.images);
        // Create a new session
        const session = await prisma.sessions.create({
            data: {
                session_id: generator.nextId(),
                name: req.body.name,
                description: req.body.description,
                //images: images,
                //type: req.body.type,
                share: req.body.share,
                start_timestamp: req.body.start_time,
                end_timestamp: req.body.end_time,
                distance: req.body.distance,
                //latitude: req.body.latitude,
                //longitude: req.body.longitude,
                author_id: _id
            }
        })
        // Send the created session in the response
        res.json({ "success": true });
    } catch (error) {
        res.status(400).json({ error });
    }
});

// Define a route for getting a specific session
router.get("/session", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Find the session with the specified ID and send it in the response
        const session = await prisma.sessions.findUnique({ where: { session_id: BigInt(req.headers.session) } })
        res.json(session);
    } catch (error) {
        // Send the error message in the response
        res.status(400).json({ error });
    }
});

// Define a route for getting sessions created by friends in the last 24 hours
router.get("/sessions", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);
    try {
        // Find the user and their friends
        // let user = await User.findOne({ "_id": _id });
        // let friends = await Friends.find({ "owner": _id });
        // let friendsId = [];
        // for (let i = 0; i < friends.length; i++) {
        //     // Get the IDs of the user's friends
        //     console.log("runing " + friends[i]["user"])
        //     friendsId.push(friends[i]["user"])
        // }
        let cutoffDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString()
        // Find sessions created by the user's friends in the last 24 hours and send them in the response
        //let session = await Session.find({ "author": { $in: friendsId }, "end_time": { $gte: cutoffDate } })
        const sessions = await prisma.$queryRaw`
        SELECT * FROM "sessions"
        WHERE "author_id" IN (
          SELECT "user1_id" FROM "friends" WHERE "user2_id" = ${_id}
          UNION
          SELECT "user2_id" FROM "friends" WHERE "user1_id" = ${_id}
        ) AND "end_timestamp" < ${cutoffDate}
      `;

        res.json(sessions);
    } catch (error) {
        // Send the error message in the response
        res.status(400).json({ error });
    }
});

// Export the router for use in other files
export default router;
