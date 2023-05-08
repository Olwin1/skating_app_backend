// Import required modules
require("dotenv").config();
import { Router } from "express"
import mongoose from "../db/connection";
import middleware from "./middleware";

// Create a new router instance
const router = Router();

// Define a route for creating a new session
router.post("/session", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = req.user;
    const { Session } = req.context.models;
    
    // Start a new transaction for creating the session
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let images = JSON.parse(req.body.images);
        // Create a new session
        let [post] = await Session.create(
            [{
                name: req.body.name,
                description: req.body.description,
                images: images,
                type: req.body.type,
                share: req.body.share,
                start_time: req.body.start_time,
                end_time: req.body.end_time,
                distance: req.body.distance,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                author: _id
            }],
            { session: session }
        );
        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        // Send the created session in the response
        res.json(post);
    } catch (error) {
        // Abort the transaction and send the error message in the response
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});

// Define a route for getting a specific session
router.get("/session", middleware.isLoggedIn, async (req: any, res) => {
    const { Session } = req.context.models;
    try {
        // Find the session with the specified ID and send it in the response
        let session = await Session.findOne({ "_id": req.headers.session })
        res.json(session);
    } catch (error) {
        // Send the error message in the response
        res.status(400).json({ error });
    }
});

// Define a route for getting sessions created by friends in the last 24 hours
router.get("/sessions", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = req.user;
    const { User, Friends, Session } = req.context.models;
    try {
        // Find the user and their friends
        let user = await User.findOne({ "_id": _id });
        let friends = await Friends.find({ "owner": _id });
        let friendsId = [];
        for (let i = 0; i < friends.length; i++) {
            // Get the IDs of the user's friends
            console.log("runing " + friends[i]["user"])
            friendsId.push(friends[i]["user"])
        }
        let cutoffDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString()
        // Find sessions created by the user's friends in the last 24 hours and send them in the response
        let session = await Session.find({ "author": { $in: friendsId }, "end_time": { $gte: cutoffDate } })
        res.json(session);
    } catch (error) {
        // Send the error message in the response
        res.status(400).json({ error });
    }
});

// Export the router for use in other files
export default router;
