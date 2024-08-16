require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import middleware from "./middleware";
import createMessage from "./MessageCreate";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});
const router = Router(); // create router to create route bundle


// This route handles creating a new message channel.
router.post("/channel", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Extract the user's ID from the request.
        const _id = BigInt((req as CustomRequest).user._id);

        // Parse the list of participants from the request and add the user's ID.
        let participants = JSON.parse(req.body.participants).concat([_id]);
        // Generate a unique channel ID.
        const channelId = generator.nextId();
        // Create a new channel in the database.
        const channel = await prisma.message_channels.create({
            data: {
                channel_id: channelId,
                creation_date: new Date().toISOString(),
                last_message_count: 0
            }
        });
        // Create participant rows for the channel in the database.
        let participantRows = await prisma.participants.createMany({
            data: participants.map((userId: bigint) => ({
                participant_id: generator.nextId(),
                user_id: userId,
                channel_id: channelId,
            })),
        });
        // Return a success response with the created channel and participants.
        return res.status(200).json({ "channel": channel, "participants": participantRows });
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

// This route handles creating a new message in a channel.
router.post("/message", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Extract the user's ID from the request.
        const _id = BigInt((req as CustomRequest).user._id);
        // Call the createMessage function to add a new message to the channel.
        let retval = await createMessage(_id, BigInt(req.body.channel), req.body.content, req.body.img);
        // Return a success response.
        res.status(200).json({ "success": true });
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ "success": false, error: error });
    }
});

// This route handles fetching a single message by ID.
router.get("/message", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Retrieve a single message by its ID from the database.
        const message = await prisma.messages.findUnique({ where: { message_id: BigInt(req.headers.message) } });
        // Return the message as a JSON response.
        return res.status(200).json(message);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

// This route handles fetching a list of messages in a channel.
router.get("/messages", middleware.isLoggedIn, async (req: any, res) => {
    try {
        const _id = BigInt((req as CustomRequest).user._id);

        // Retrieve the channel details by its ID.
        const channel = await prisma.message_channels.findUnique({
            where: { channel_id: BigInt(req.headers.channel) },
        });

        // Fetch a list of messages within the specified page range.
        const messages = await prisma.messages.findMany({
            where: {
                AND: [
                    { message_number: { gte: channel!.last_message_count - req.headers.page * 20 - 20 } },
                    { message_number: { lte: channel!.last_message_count - req.headers.page * 20 } },
                ]
            },
            take: 20,
            orderBy: { message_number: 'desc' }
        });

        // Return the list of messages as a JSON response.
        res.status(200).json(messages);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

// This route handles fetching a list of channels for the authenticated user.
router.get("/channels", middleware.isLoggedIn, async (req: any, res) => {
    try {
        const _id = BigInt((req as CustomRequest).user._id);

        // Retrieve a list of channels associated with the user.
        const channels = await prisma.participants.findMany({
            where: {
                user_id: _id,
            },
            include: {
                message_channels: true,
            },
        });
        let channelIds: bigint[] = []
        for (const channel of channels) {
            channelIds.push(channel.channel_id)
        }
        const returnChannels = await prisma.message_channels.findMany({
            where: { channel_id: { in: channelIds } },
            include: {
                participants: {
                    include: {
                        users: true
                    }
                }
            }
        });

        // Return the list of channels as a JSON response.
        res.status(200).json(returnChannels);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

// This route handles fetching details of a single channel.
router.get("/channel", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Retrieve details of a channel by its ID.
        const channel = await prisma.message_channels.findUnique({ where: { channel_id: BigInt(req.headers.channel) } });
        // Return the channel details as a JSON response.
        res.status(200).json(channel);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

// This route handles fetching a list of users for the authenticated user.
router.get("/users", middleware.isLoggedIn, async (req: any, res) => {
    try {
        const _id = BigInt((req as CustomRequest).user._id);

        // Retrieve a list of user IDs associated with the authenticated user's channels.
        let channelIds = [];
        const userParticipant = await prisma.participants.findMany({ where: { user_id: _id } });
        for (let x = 0; x < userParticipant.length; x++) {
            channelIds.push(userParticipant[x].channel_id);
        }

        // Retrieve a list of participants in the user's channels who are not the authenticated user.
        const participants = await prisma.participants.findMany({ where: { AND: [{ channel_id: { in: channelIds } }, { user_id: { not: _id } }] } });

        // Extract user IDs from the participants list.
        const participantIds: bigint[] = []
        participants.map((participant) => {
            participantIds.push(participant.user_id);
        });

        // Retrieve user IDs of friends not in the participant list.
        const friendUserIds: bigint[] = []
        const usersFriends = await prisma.friends.findMany({
            where: {
                AND: [
                    { OR: [{ user1_id: _id }, { user2_id: _id }] },
                    { AND: [{ user1_id: { not: { in: participantIds } } }, { user2_id: { not: { in: participantIds } } }] }
                ]
            },
            skip: req.headers.page * 20,
            take: 20
        });
        usersFriends.map((friend) => {
            friendUserIds.push(friend.user1_id == _id ? friend.user2_id : friend.user1_id);
        });

        // Retrieve user details of friends not in the participant list.
        let users = await prisma.users.findMany({ where: { user_id: { in: friendUserIds } } });

        // If there are fewer than 20 users, retrieve additional users who are not in the participant list.
        if (users.length < 20) {
            users = [...users, ...await prisma.users.findMany({
                where: {
                    NOT: {
                        user_id: {
                            in: [...participantIds, ...friendUserIds, _id],
                        },
                    },
                    followers_followers_user_idTousers: {
                        some: {
                            user_id: _id,
                        },
                    },
                },
                skip: req.headers.page * 20,
                take: 20
            })];
        }

        // Prepare and return the list of users as a JSON response.
        let retvals: {
            user_id: bigint;
            username: string;
            avatar_id: string | null;
        }[] = []
        users.map((user) => {
            retvals.push({
                "user_id": user.user_id,
                "username": user.username,
                "avatar_id": user.avatar_id
            })
        });
        res.status(200).json(retvals);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});




// This route handles fetching details of a single channel.
router.delete("/channel", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Retrieve details of a channel by its ID.
        const participants = await prisma.participants.deleteMany({ where: { channel_id: BigInt(req.headers.channel) } });
        const messages = await prisma.messages.deleteMany({ where: { channel_id: BigInt(req.headers.channel) } });
        const channel = await prisma.message_channels.delete({ where: { channel_id: BigInt(req.headers.channel) } });
        // Return the channel details as a JSON response.
        res.status(200).json(channel);
    } catch (error) {
        // Handle any errors and return a 500 Internal Server Error response.
        res.status(500).json({ success: false, error: error });
    }
});

export default router;