require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";
import createMessage from "./MessageCreate";
import CustomRequest from "./CustomRequest";

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;


// Route to create a new channel with the specified participants
router.post("/channel", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user ID from the authenticated user object
    const { _id } = (req as CustomRequest).user;
    const { User, Channel, Channels } = (req as CustomRequest).context.models;
    // Start a new MongoDB session
    const session = await mongoose.startSession();
    // Start a transaction within the session
    session.startTransaction();
    try {
        // Find the user who initiated the channel creation
        let user = await User.findOne({ '_id': _id }).session(session);
        // Combine the user ID with the IDs of the participants to create a list of all participants
        let participants = req.body.participants.concat([_id])
        // Create a new channel with the specified participants and the current date, using the session
        let [channel] = await Channel.create([{ participants: participants, creation_date: Date(), last_message_count: 0, }], { session: session })
        // If the user already has a "Channels" document in the database, add the new channel ID to the list of channels
        if (user.channels) {
            await Channels.updateOne(
                { "_id": user.channels },
                { $push: { "channels": channel._id } }
            ).session(session);
        }
        // If the user doesn't have a "Channels" document, create one and add the new channel ID to it
        else {
            let [channels] = await Channels.create([{ channels: [channel] }], { session: session })
            await User.updateOne(
                { "_id": user._id },
                { $set: { "channels": channels._id } }
            ).session(session);
        }
        // If there are more than 2 participants in the channel, add the new channel ID to each participant's "Channels" document
        if (participants.length > 2) {
            // Find all the user documents for the other participants in the channel
            let participantUsers = await User.find({ '_id': { $in: req.body.participants } }).session(session);
            for (let i = 0; i < participantUsers.length; i++) {
                // If the participant already has a "Channels" document, add the new channel ID to the list of channels
                if (participantUsers[i].channels) {
                    await Channels.updateOne(
                        { "_id": participantUsers[i].channels },
                        { $push: { "channels": channel._id } }
                    ).session(session);
                }
                // If the participant doesn't have a "Channels" document, create one and add the new channel ID to it
                else {
                    let [channels] = await Channels.create([{ channels: [channel] }], { session: session })
                    await User.updateOne(
                        { "_id": participantUsers[i]._id },
                        { $set: { "channels": channels._id } }
                    ).session(session);
                }
            }
        }
        // If all transactions succeed, commit the session
        await session.commitTransaction();
        res.status(200).json({ success: true });
    } catch (error) {
        // If any transaction fails, abort the session and return an error response
        await session.abortTransaction();
        res.status(500).json({ success: false, error: error });
    } finally {
        // End the session
        session.endSession();
    }
});



// Route to create a new message
router.post("/message", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    let retval = await createMessage(_id, req.body.channel, req.body.content, req.body.img);
    res.json(retval);

});



// Route to create a get message
router.get("/message", middleware.isLoggedIn, async (req: any, res) => {
    const { Message } = (req as CustomRequest).context.models;
    const session = await mongoose.startSession(); // start a new MongoDB transaction session
    session.startTransaction(); // start a transaction within the session
    try {
        let message = await Message.findOne({ '_id': req.headers.message, 'message_number': req.headers.message_number, 'channel': req.headers.channel }).session(session); // get a single message

        await session.commitTransaction(); // commit the transaction to the database
        res.status(200).json(message); // send a success response to the client
    } catch (error) {
        await session.abortTransaction(); // abort the transaction if an error occurs
        res.status(500).json({ success: false, error: error }); // send an error response to the client
    } finally {
        session.endSession(); // end the session
    }
});


// Route for retrieving messages from a specific channel
router.get("/messages", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Channel, Message } = (req as CustomRequest).context.models;

    // Start a session and transaction for the database operations
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Find the channel with the specified ID that the user is a participant in
        let channel = await Channel.findOne({ '_id': req.headers.channel, 'participants': _id }).session(session);
        // Retrieve the last 20 messages from the channel
        let messages = await Message.find({ 'message_number': { $gte: channel.last_message_count - req.headers.page * 20 - 20, $lte: channel.last_message_count - req.headers.page * 20 }, 'channel': channel._id }).limit(20).sort('-message_number').session(session);

        // Commit the transaction to the database and return the messages
        await session.commitTransaction();
        res.status(200).json(messages);
    } catch (error) {
        // If an error occurs, abort the transaction and return an error response
        await session.abortTransaction();
        res.status(500).json({ success: false, error: error });
    } finally {
        // End the session once the transaction is complete
        session.endSession();
    }
});

// Route for retrieving a list of channels that the user is a member of
router.get("/channels", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { User, Channels, Channel } = (req as CustomRequest).context.models;

    // Start a session and transaction for the database operations
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Find the user with the specified ID
        let user = await User.findOne({ '_id': _id }).session(session);
        // Retrieve the list of channels that the user is a member of
        let channels = await Channels.findOne({ '_id': user.channels }).session(session);
        // Retrieve a list of channel objects based on the channel IDs in the user's channels list
        if (channels == null) {
            await session.abortTransaction();
            return res.json([])
        }
        let channelList = await Channel.find({ '_id': { $in: channels.channels } }).limit(20).skip(parseInt(req.headers.page) * 20).session(session);

        // Commit the transaction to the database and return the channel list
        await session.commitTransaction();
        res.status(200).json(channelList);
    } catch (error) {
        // If an error occurs, abort the transaction and return an error response
        await session.abortTransaction();
        res.status(500).json({ success: false, error: error });
    } finally {
        // End the session once the transaction is complete
        session.endSession();
    }
});


// This route handles GET requests to '/channel'
router.get("/channel", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request object
    const { _id } = (req as CustomRequest).user;
    // Extract the 'Channel' model from the request contextf object
    const { Channel } = (req as CustomRequest).context.models;
    // Start a new Mongoose session
    const session = await mongoose.startSession();

    // Start a transaction within the session
    session.startTransaction();
    try {
        // Find a channel with the given ID that the user is a participant of
        let channel = await Channel.findOne({ '_id': req.headers.channel, 'participants': _id }).session(session);

        // Commit the transaction if everything went well
        await session.commitTransaction();

        // Send a response with the found channel
        res.status(200).json(channel);
    } catch (error) {
        // If there was an error, abort the transaction
        await session.abortTransaction();

        // Send a response with an error message
        res.status(500).json({ success: false, error: error });
    } finally {
        // End the session
        session.endSession();
    }
});




export default router;