require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";
import createMessage from "./MessageCreate";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import { Prisma } from "@prisma/client";


// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});
const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;



// Route to create a new channel with the specified participants
router.post("/channel", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user ID from the authenticated user object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        let participants = JSON.parse(req.body.participants).concat([_id])
        const channelId = generator.nextId();
        const channel = await prisma.message_channels.create({
            data: {
                channel_id: channelId,
                creation_date: Date(),
                last_message_count: 0
            }
        })
        let participantRows = await prisma.participants.createMany({
            data: participants.map((userId: bigint) => ({
                participant_id: generator.nextId(),
                user_id: userId,
                channel_id: channelId,
            })),
        });


        return res.status(200).json({ "channel": channel, "participants": participantRows });
    } catch (error) {
        // If any transaction fails, abort the session and return an error response
        res.status(500).json({ success: false, error: error });
    }
});



// Route to create a new message
router.post("/message", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);
    let retval = await createMessage(_id, BigInt(req.body.channel), req.body.content, req.body.img);
    res.json(retval);

});



// Route to create a get message
router.get("/message", middleware.isLoggedIn, async (req: any, res) => {
    try {
        const message = await prisma.messages.findUnique({ where: { message_id: BigInt(req.headers.message) } })
        return res.status(200).json(message); // send a success response to the client
    } catch (error) {
        res.status(500).json({ success: false, error: error }); // send an error response to the client
    }
});


// Route for retrieving messages from a specific channel
router.get("/messages", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const channel = await prisma.message_channels.findUnique({
            where:
                { channel_id: BigInt(req.headers.channel) },
        });

        const messages = await prisma.messages.findMany(
            {
                where: {
                    AND: [
                        { message_number: { gte: channel!.last_message_count - req.headers.page * 20 - 20 } },
                        { message_number: { lte: channel!.last_message_count - req.headers.page * 20 } },
                    ]
                },
                take: 20,
                orderBy: { message_number: 'desc' }

            }
        );


        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ success: false, error: error });
    }
});

// Route for retrieving a list of channels that the user is a member of
router.get("/channels", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const channels = await prisma.participants.findMany({
            where: {
                user_id: _id,
            },
            include: {
                message_channels: true,
            },
        });
        res.status(200).json(channels);
    } catch (error) {
        // If an error occurs, abort the transaction and return an error response
        res.status(500).json({ success: false, error: error });
    }
});


// This route handles GET requests to '/channel'
router.get("/channel", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Find a channel with the given ID that the user is a participant of
        const channel = prisma.message_channels.findUnique({ where: { channel_id: BigInt(req.headers.channel) } })


        // Send a response with the found channel
        res.status(200).json(channel);
    } catch (error) {
        // Send a response with an error message
        res.status(500).json({ success: false, error: error });
    }
});


router.get("/users", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);


    try {

        // Create an array to store the user IDs from previous conversations
        let channelIds = [];
        const userParticipant = await prisma.participants.findMany({ where: { user_id: _id } })
        for (let x = 0; x < userParticipant.length; x++) {
            channelIds.push(userParticipant[x].channel_id
            )
        }
        const participants = await prisma.participants.findMany({ where: { AND: [{ channel_id: { in: channelIds } }, { user_id: { not: _id } }] } });
        const participantIds: bigint[] = []
        participants.map((participant) => {
            participantIds.push(participant.user_id);
        })
        const friendUserIds: bigint[] = []

        const usersFriends = await prisma.friends.findMany({ where: { AND: [{ OR: [{ user1_id: _id }, { user2_id: _id }] }, { AND: [{ user1_id: { not: { in: participantIds } } }, { user2_id: { not: { in: participantIds } } }] }] }, skip: req.headers.page * 20, take: 20 });
        usersFriends.map((friend) => {
            friendUserIds.push(friend.user1_id == _id ? friend.user2_id : friend.user1_id);
        })
        let users = await prisma.users.findMany({ where: { user_id: { in: friendUserIds } } })
        // If there are less than 20 results, find following users who are not in previous conversations, with pagination
        if (users.length < 20) {
            users = [...users, ...await prisma.users.findMany({
                where: {
                    NOT: {
                        user_id: {
                            in: [...participantIds, ...friendUserIds],
                        },
                    },
                    followers_followers_user_idTousers: {
                        some: {
                            user_id: _id, // User for whom you want to get followers
                        },
                    },
                },
                skip: req.headers.page * 20, take: 20
            })];
        }

        let retvals: {
            user_id: bigint; username
            : string; avatar: string | null;
        }[] = []
        users.map((user) => {
            retvals.push({
                "user_id": user.user_id,
                "username": user.username,
                "avatar": user.avatar_id
            })
        })
        // Commit the MongoDB transaction and send the response with the retrieved user IDs
        res.status(200).json(retvals);
    } catch (error) {
        // If there is an error, abort the transaction and send an error response
        res.status(500).json({ success: false, error: error });
    }
});




export default router;