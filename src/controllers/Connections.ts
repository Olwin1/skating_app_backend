require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library

const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// Define a route that allows a user to follow another user
router.post("/follow", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: _id, requestee_id: target },
        },
      },
    });

    // Check if a follow request already exists
    if (
      targetUser?.follow_requests_follow_requests_requester_idTousers.length !=
      0
    ) {
      console.log("Follow request already exists.");
    } else {
      // If no follow request exists, check if the target user's profile is public
      if (targetUser.public_profile == false) {
        // Create a new follow request
        const newFollowRequest = await prisma.follow_requests.create({
          data: {
            request_id: generator.nextId(),
            requester_id: _id,
            requestee_id: target,
            timestamp: new Date().toISOString(),
          },
        });
        console.log("Follow request created successfully.");
        return res.status(200).json({ success: true, requested: true });
      } else {
        // If the target user's profile is public, establish a follower-following relationship
        const followingData = {
          following_id: generator.nextId(),
          following_user_id: target,
          user_id: _id,
          timestamp: new Date().toISOString(),
        };
        const followerData = {
          follower_id: generator.nextId(),
          follower_user_id: _id,
          user_id: target,
          timestamp: new Date().toISOString(),
        };
        const result = await prisma.$transaction([
          prisma.following.create({ data: followingData }),
          prisma.followers.create({ data: followerData }),
        ]);
        return res.status(200).json({ success: true, requested: false });
      }
    }
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route for sending a friend request
router.post("/friend", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Create a friend request
    const friendRequest = await prisma.friend_requests.create({
      data: {
        request_id: generator.nextId(),
        requester_id: _id,
        requestee_id: BigInt(req.body.user),
        timestamp: new Date().toISOString(),
      },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route for unfollowing a user
router.post("/unfollow", middleware.isLoggedIn, async (req, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: _id, requestee_id: target },
        },
      },
    });

    // Check if a follow request exists for unfollowing
    if (
      targetUser?.follow_requests_follow_requests_requester_idTousers.length !=
      0
    ) {
      // Delete the follow request to unfollow the user
      const followRequest = await prisma.follow_requests.delete({
        where: {
          request_id:
            targetUser?.follow_requests_follow_requests_requester_idTousers[0]
              .request_id,
        },
      });
      return res.status(200).json({ success: true, requested: true });
    } else {
      // If no follow request exists, remove the follower-following relationship
      const result = await prisma.$transaction([
        prisma.following.deleteMany({
          where: { following_user_id: target, user_id: _id },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: _id, user_id: target },
        }),
      ]);
      return res.status(200).json({ success: true, requested: false });
    }
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route for unfollowing a user as the follower
router.post("/unfollower", middleware.isLoggedIn, async (req, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: target, requestee_id: _id },
        },
      },
    });

    // Check if a follow request exists for unfollowing as the follower
    if (
      targetUser?.follow_requests_follow_requests_requester_idTousers.length !=
      0
    ) {
      // Delete the follow request to unfollow the user
      const followRequest = await prisma.follow_requests.delete({
        where: {
          request_id:
            targetUser?.follow_requests_follow_requests_requester_idTousers[0]
              .request_id,
        },
      });
      return res.status(200).json({ success: true, request: true });
    } else {
      // If no follow request exists, remove the follower-following relationship
      const result = await prisma.$transaction([
        prisma.following.deleteMany({
          where: { following_user_id: _id, user_id: target },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: target, user_id: _id },
        }),
      ]);
      return res.status(200).json({ success: true, request: false });
    }
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route for unfriending a user
router.post("/unfriend", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including friend requests and friend relationships
    const friendInfo = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        friend_requests_friend_requests_requestee_idTousers: {
          where: { requester_id: _id, requestee_id: target },
        },
        friends_friends_user1_idTousers: {
          where: {
            OR: [
              { user1_id: _id, user2_id: target },
              { user1_id: target, user2_id: _id },
            ],
          },
        },
      },
    });
    const length =
      friendInfo?.friend_requests_friend_requests_requestee_idTousers.length;
    if (length != null && length != 0) {
      // If no friend request exists, delete the friend request to unfriend the user
      const retval = await prisma.friend_requests.delete({
        where: {
          request_id:
            friendInfo?.friend_requests_friend_requests_requestee_idTousers[0]
              .request_id,
        },
      });
      res.status(200).json({ success: true, request: true });
    } else if (
      friendInfo != null &&
      friendInfo!.friends_friends_user1_idTousers.length != 0
    ) {
      // If a friend request exists, remove the friend relationship
      const retval = await prisma.friends.delete({
        where: {
          friendship_id:
            friendInfo!.friends_friends_user1_idTousers[0].friendship_id,
        },
      });
      return res.status(200).json({ success: true, request: false });
    } else {
      return res.status(400).json({ success: false });
    }
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route to retrieve a user's followers
router.get("/followers", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    const target = BigInt(req.headers.user ?? _id);
    // Retrieve the list of follower users for the target user
    const followerUsers = await prisma.users
      .findUnique({
        where: { user_id: target },
      })
      .followers_followers_user_idTousers({
        take: 20,
        skip: req.headers.page * 20,
        include: {
          users_followers_follower_user_idTousers: true,
        },
      });

    let returningUsers = [];
    if (followerUsers == null) {
      throw new Error("No followed users found");
    }
    for (let followerUser of followerUsers) {
      returningUsers.push({
        user_id: followerUser.users_followers_follower_user_idTousers.user_id,
        avatar_id:
          followerUser.users_followers_follower_user_idTousers.avatar_id,
        description:
          followerUser.users_followers_follower_user_idTousers.description,
        public_profile:
          followerUser.users_followers_follower_user_idTousers.public_profile,
        country: followerUser.users_followers_follower_user_idTousers.country,
        username: followerUser.users_followers_follower_user_idTousers.username,
        display_name:
          followerUser.users_followers_follower_user_idTousers.display_name,
        user_role:
          followerUser.users_followers_follower_user_idTousers.user_role,
      });
    }
    return res.status(200).json(returningUsers);
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route to retrieve a user's following users
router.get("/following", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    const target = BigInt(req.headers.user ?? _id);
    // Retrieve the list of followed users for the target user
    const followedUsers = await prisma.users
      .findUnique({
        where: { user_id: target },
      })
      .following_following_user_idTousers({
        take: 20,
        skip: req.headers.page * 20,
        include: {
          users_following_following_user_idTousers: true,
        },
      });
    let returningUsers = [];
    if (followedUsers == null) {
      throw new Error("No followed users found");
    }
    for (let followedUser of followedUsers) {
      returningUsers.push({
        user_id: followedUser.users_following_following_user_idTousers.user_id,
        avatar_id:
          followedUser.users_following_following_user_idTousers.avatar_id,
        description:
          followedUser.users_following_following_user_idTousers.description,
        public_profile:
          followedUser.users_following_following_user_idTousers.public_profile,
        country: followedUser.users_following_following_user_idTousers.country,
        username:
          followedUser.users_following_following_user_idTousers.username,
        display_name:
          followedUser.users_following_following_user_idTousers.display_name,
        user_role:
          followedUser.users_following_following_user_idTousers.user_role,
      });
    }
    return res.status(200).json(returningUsers);
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

// Define a route to retrieve a user's friends
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    const target = BigInt(req.headers.user ?? _id);
    const pageSize = 20;

    // Use a transaction to retrieve a combined list of user1's and user2's friends
    prisma.$transaction(async (tx) => {
      const user1Friends = await tx.users
        .findUnique({
          where: { user_id: target },
        })
        .friends_friends_user1_idTousers({
          take: pageSize,
          skip: req.headers.page * pageSize,
          include: {
            users_friends_user2_idTousers: true,
          },
        });
      const len = user1Friends == null ? 0 : user1Friends!.length;
      const user2Friends = await tx.users
        .findUnique({
          where: { user_id: target },
        })
        .friends_friends_user2_idTousers({
          take: pageSize - len,
          skip: Math.max(0, req.headers.page * pageSize - len),
          include: {
            users_friends_user1_idTousers: true,
          },
        });

      let returningUsers = [];
      if (user1Friends != null) {
        for (let friendUser of user1Friends) {
          returningUsers.push({
            user_id: friendUser.users_friends_user2_idTousers.user_id,
            avatar_id: friendUser.users_friends_user2_idTousers.avatar_id,
            description: friendUser.users_friends_user2_idTousers.description,
            public_profile:
              friendUser.users_friends_user2_idTousers.public_profile,
            country: friendUser.users_friends_user2_idTousers.country,
            username: friendUser.users_friends_user2_idTousers.username,
            display_name: friendUser.users_friends_user2_idTousers.display_name,
            user_role: friendUser.users_friends_user2_idTousers.user_role,
          });
        }
      }

      if (user2Friends != null) {
        for (let friendUser of user2Friends) {
          returningUsers.push({
            user_id: friendUser.users_friends_user1_idTousers.user_id,
            avatar_id: friendUser.users_friends_user1_idTousers.avatar_id,
            description: friendUser.users_friends_user1_idTousers.description,
            public_profile:
              friendUser.users_friends_user1_idTousers.public_profile,
            country: friendUser.users_friends_user1_idTousers.country,
            username: friendUser.users_friends_user1_idTousers.username,
            display_name: friendUser.users_friends_user1_idTousers.display_name,
            user_role: friendUser.users_friends_user1_idTousers.user_role,
          });
        }
      }

      return res.status(200).json(returningUsers);
    });
  } catch (error) {
    // Handle any errors that occur during this process
    res.status(400).json({ error });
  }
});

router.patch("/follow", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Convert user IDs to BigInt
    const _id = BigInt((req as CustomRequest).user._id); // Current user's ID
    const target = BigInt(req.body.user); // Target user's ID
    const accepted = req.body.accepted; // Whether the follow request is accepted

    // Find the follow request in the database
    const followRequest = await prisma.follow_requests.findFirst({
      where: { requester_id: target, requestee_id: _id },
    });

    if (!followRequest) {
      throw "No follow request made";
    }

    // Delete the follow request
    const deletionFollowRequest = await prisma.follow_requests.delete({
      where: { request_id: followRequest?.request_id },
    });

    if (accepted) {
      // If the request is accepted, create records in 'following' and 'followers' tables
      const following = await prisma.following.create({
        data: {
          following_id: generator.nextId(),
          following_user_id: target,
          user_id: _id,
          timestamp: new Date().toISOString(),
        },
      });
      const followers = await prisma.followers.create({
        data: {
          follower_id: generator.nextId(),
          follower_user_id: _id,
          user_id: target,
          timestamp: new Date().toISOString(),
        },
      });
      //TODO verify target and id right way round

      // Respond with success and acceptance status
      return res.status(200).json({ success: true, accepted: true });
    }

    // If the request is not accepted, respond with success and rejection status
    return res.status(200).json({ success: true, accepted: false });
  } catch (error) {
    // Handle any errors and respond with a 400 Bad Request status
    res.status(400).json({ error });
  }
});

// This is a route handler for a PATCH request to "/friend".
router.patch("/friend", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user's ID from the request object.
    const _id = BigInt((req as CustomRequest).user._id);

    // Extract the target user's ID from the request body.
    const target = BigInt(req.body.user);

    // Delete any existing friend requests between the current user and the target user.
    const request = await prisma.friend_requests.deleteMany({
      where: { requestee_id: _id, requester_id: target },
    });

    // Check if no friend request was found to delete.
    if (request.count == 0) {
      return res.json({ error: "No existing request" });
    }

    // Check if the request body contains an "accepted" flag.
    if (req.body.accepted) {
      // Create a new entry in the "friends" table to represent the accepted friendship.
      const friendObject = await prisma.friends.create({
        data: {
          friendship_id: generator.nextId(),
          user1_id: _id,
          user2_id: target,
          timestamp: new Date().toISOString(),
        },
      });
      return res.status(200).json({ success: true, accepted: true });
    } else {
      // If the "accepted" flag is not set, return a response indicating that the request was not accepted.
      return res.status(200).json({ success: true, accepted: false });
    }
  } catch (error) {
    // Handle any errors that may occur during the execution of this code.
    res.status(400).json({ error });
  }
});

export default router;
