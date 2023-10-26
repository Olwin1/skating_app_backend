require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library


const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});

// Define a route handler to handle a POST request to "/follow"
router.post("/follow", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.body.user); // Replace with the ID of the user to be followed


        // Check if the follow request already exists
        const targetUser = await prisma.users.findUnique({ where: { user_id: target }, include: { follow_requests_follow_requests_requester_idTousers: { where: { requester_id: _id, requestee_id: target } } } })


        if (targetUser?.follow_requests_follow_requests_requester_idTousers.length != 0) {
            // If a request already exists, you can handle it as desired (e.g., update the request status).
            console.log('Follow request already exists.');
        } else {
            if (targetUser.public_profile == false) {

                // Create a new follow request
                const newFollowRequest = await prisma.follow_requests.create({
                    data: {
                        request_id: generator.nextId(),
                        requester_id: _id,
                        requestee_id: target,
                        status: 'pending', // You can set the initial status as needed (e.g., 'pending').
                    },
                });

                console.log('Follow request created successfully.');
                return res.status(200).json({ "success": true, "requested": true })
            }
            else {
                const followingData = {
                    following_id: generator.nextId(),
                    following_user_id: target,
                    user_id: _id
                };

                const followerData = {
                    follower_id: generator.nextId(),
                    follower_user_id: _id,
                    user_id: target
                };

                const result = await prisma.$transaction([
                    prisma.following.create({ data: followingData }),
                    prisma.followers.create({ data: followerData })
                ]);
                return res.status(200).json({ "success": true, "requested": false })
            }
        }
    } catch (error) {

        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});


// Define a route handler to handle a POST request to "/friend"
router.post("/friend", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const friendRequest = await prisma.friend_requests.create({
            data: {
                request_id: generator.nextId(),
                requester_id: _id,  // The ID of the user sending the request
                requestee_id: BigInt(req.body.user),  // The ID of the target user
                status: 'pending',  // You can set the initial status as 'pending'
            },
        });
        return res.status(200).json({ "success": true })

    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});


// Route for unfollowing a user
router.post("/unfollow", middleware.isLoggedIn, async (req, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.body.user); // Replace with the ID of the user to be followed


        // Check if the follow request already exists
        const targetUser = await prisma.users.findUnique({ where: { user_id: target }, include: { follow_requests_follow_requests_requester_idTousers: { where: { requester_id: _id, requestee_id: target } } } })


        if (targetUser?.follow_requests_follow_requests_requester_idTousers.length != 0) {
            // If a request already exists, you can handle it as desired (e.g., update the request status).
            const followRequest = await prisma.follow_requests.delete({ where: { request_id: targetUser?.follow_requests_follow_requests_requester_idTousers[0].request_id } })
            return res.status(200).json({ "success": true, "requested": true });
        } else {
            const result = await prisma.$transaction([
                prisma.following.deleteMany({ where: { following_user_id: target, user_id: _id } }),
                prisma.followers.deleteMany({ where: { follower_user_id: _id, user_id: target } })
            ]);
            return res.status(200).json({ "success": true, "requested": false });

        }
    } catch (error) {
        res.status(400).json({ error });
    }
});

// Route for unfollowing a user
router.post("/unfollower", middleware.isLoggedIn, async (req, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.body.user); // Replace with the ID of the user to be followed


        // Check if the follow request already exists
        const targetUser = await prisma.users.findUnique({ where: { user_id: target }, include: { follow_requests_follow_requests_requester_idTousers: { where: { requester_id: target, requestee_id: _id } } } })


        if (targetUser?.follow_requests_follow_requests_requester_idTousers.length != 0) {
            // If a request already exists, you can handle it as desired (e.g., update the request status).
            const followRequest = await prisma.follow_requests.delete({ where: { request_id: targetUser?.follow_requests_follow_requests_requester_idTousers[0].request_id } })
            return res.status(200).json({ "success": true, "request": true });
        } else {
            const result = await prisma.$transaction([
                prisma.following.deleteMany({ where: { following_user_id: _id, user_id: target } }),
                prisma.followers.deleteMany({ where: { follower_user_id: target, user_id: _id } })
            ]);
            return res.status(200).json({ "success": true, "request": false });

        }
    } catch (error) {
        res.status(400).json({ error });
    }
});



router.post("/unfriend", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.body.user);
        const friendInfo = await prisma.users.findUnique({
            where: { user_id: target }, include: {
                friend_requests_friend_requests_requestee_idTousers: { where: { requester_id: _id, requestee_id: target } }, friends_friends_user1_idTousers: {
                    where: { OR: [{ user1_id: _id, user2_id: target }, { user1_id: target, user2_id: _id }] }
                }
            }
        });
        if (!friendInfo?.friend_requests_friend_requests_requestee_idTousers.length) {
            const retval = await prisma.friend_requests.delete({ where: { request_id: friendInfo?.friend_requests_friend_requests_requestee_idTousers[0].request_id } })
            res.status(200).json({ "success": true, "request": true });
        }
        else {
            const retval = await prisma.friends.delete({ where: { friendship_id: friendInfo.friends_friends_user1_idTousers[0].friendship_id } })
            return res.status(200).json({ "success": true, "request": false });
        }
    } catch (error) {
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/followers"
router.get("/followers", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.headers.user ?? _id)
        const followerUsers = await prisma.users.findUnique({
            where: { user_id: target },
        }).followers_followers_user_idTousers({
            take: 20,
            skip: (req.headers.page) * 20,
        });
        return res.status(200).json(followerUsers);
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/following"
router.get("/following", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.headers.user ?? _id)
        const followedUsers = await prisma.users.findUnique({
            where: { user_id: target },
        }).following_following_user_idTousers({
            take: 20,
            skip: (req.headers.page) * 20,
        });
        return res.status(200).json(followedUsers);
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/friends"
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        const target = BigInt(req.headers.user ?? _id);
        const pageSize = 20;


        prisma.$transaction(async (tx) => {
            const user1Friends = await tx.users.findUnique({
                where: { user_id: target }
            }).friends_friends_user1_idTousers({
                take: pageSize,
                skip: (req.headers.page) * pageSize
            });
            const len = user1Friends == null ? 0 : user1Friends!.length
            const user2Friends = await tx.users.findUnique({
                where: { user_id: target }
            }).friends_friends_user2_idTousers({
                take: pageSize - len,
                skip: Math.max(0, (req.headers.page) * pageSize - len)
            });

            return [...user1Friends ?? [], ...user2Friends ?? []];
        });
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});


router.patch("/follow", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Get the user ID from the request object
        const _id = BigInt((req as CustomRequest).user._id);
        const target = BigInt(req.body.user);
        const accepted = req.body.accepted

        const followRequest = await prisma.follow_requests.findFirst({ where: { requester_id: target, requestee_id: _id } });
        if (!followRequest) {
            throw ("No follow request made");
        }
        const deletionFollowRequest = await prisma.follow_requests.delete({ where: { request_id: followRequest?.request_id } });
        if (accepted) {
            const following = await prisma.following.create({
                data: {
                    following_id: generator.nextId(),
                    following_user_id: target,
                    user_id: _id
                }
            })
            const followers = await prisma.followers.create({
                data: {
                    follower_id: generator.nextId(),
                    follower_user_id: _id,
                    user_id: target
                }
            })//TODO verify target and id right way round
            return res.status(200).json({ "success": true, "accepted": true })
        }
        return res.status(200).json({ "success": true, "accepted": false })


    } catch (error) {
        res.status(400).json({ error });
    }
});


router.patch("/friend", middleware.isLoggedIn, async (req: any, res) => {
    try {
        // Get the user ID from the request object
        const _id = BigInt((req as CustomRequest).user._id);

        // Find the user to friend in the Friends collection
        const target = BigInt(req.body.user);
        const request = await prisma.friend_requests.deleteMany({ where: { requestee_id: _id, requester_id: target } });
        if (request.count == 0) {
            return res.json({ "error": "No existing request" })
        }
        if (req.body.accepted) {
            const friendObject = await prisma.friends.create({
                data: {
                    friendship_id: generator.nextId(),
                    user1_id: _id,
                    user2_id: target
                }
            });
            return res.status(200).json({ "success": true, "accepted": true })

        }
        else {
            return res.status(200).json({ "success": true, "accepted": false })
        }

    } catch (error) {
        res.status(400).json({ error });
    }
});



export default router;