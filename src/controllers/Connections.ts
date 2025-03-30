require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import HandleBlocks from "../utils/handleBlocks";

import RouteBuilder from "../utils/RouteBuilder";
import CheckNulls from "../utils/checkNulls";

const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// Define a route that allows a user to follow another user
router.post("/follow", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: req.userId, requestee_id: target },
        },
        // Get Info on blocked user data
        ...HandleBlocks.getIncludeBlockInfo(req.userId!),
      },
    });
    // Check if the user is blocked or the other way round
    const isBlocked = HandleBlocks.checkIsBlocked(targetUser);
    if (isBlocked) {
      throw Error("Target user has been blocked by you or has blocked you");
    }

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
            requester_id: req.userId!,
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
          user_id: req.userId!,
          timestamp: new Date().toISOString(),
        };
        const followerData = {
          follower_id: generator.nextId(),
          follower_user_id: req.userId!,
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
}));

// Define a route for sending a friend request
router.post("/friend", ...RouteBuilder.createRouteHandler(async (req, res) => {
    const targetUser = await prisma.users.findFirst({
      where: { user_id: req.body.user },
      include: HandleBlocks.getIncludeBlockInfo(req.userId!),
    });
    // Check if the user is blocked or the other way round
    const isBlocked = HandleBlocks.checkIsBlocked(targetUser);
    if (isBlocked) {
      throw Error("Target user has been blocked by you or has blocked you");
    }

    // Create a friend request
    const friendRequest = await prisma.friend_requests.create({
      data: {
        request_id: generator.nextId(),
        requester_id: req.userId!,
        requestee_id: BigInt(req.body.user),
        timestamp: new Date().toISOString(),
      },
    });
    return res.status(200).json({ success: true });
}));

// Define a route for unfollowing a user
router.post("/unfollow", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: req.userId, requestee_id: target },
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
          where: { following_user_id: target, user_id: req.userId },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: req.userId, user_id: target },
        }),
      ]);
      return res.status(200).json({ success: true, requested: false });
    }
}));

// Define a route for unfollowing a user as the follower
router.post("/unfollower", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: target, requestee_id: req.userId },
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
          where: { following_user_id: req.userId, user_id: target },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: target, user_id: req.userId },
        }),
      ]);
      return res.status(200).json({ success: true, request: false });
    }
}));

// Define a route for unfriending a user
router.post("/unfriend", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Extract the target user's ID from the request
    const target = BigInt(req.body.user);

    // Retrieve information about the target user, including friend requests and friend relationships
    const friendInfo = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        friend_requests_friend_requests_requestee_idTousers: {
          where: { requester_id: req.userId, requestee_id: target },
        },
        friends_friends_user1_idTousers: {
          where: {
            OR: [
              { user1_id: req.userId, user2_id: target },
              { user1_id: target, user2_id: req.userId },
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
}));

// Define a route to retrieve a user's followers
router.get("/followers", ...RouteBuilder.createRouteHandler(async (req, res) => {

    const page = CheckNulls.checkNullPage(req.headers.page);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if(req.headers.user && req.headers.user instanceof String) {
      target = BigInt(req.headers.user as string);
    }
    // Retrieve the list of follower users for the target user
    const followerUsersRaw = await prisma.users
      .findUnique({
        where: { user_id: target },
        include: {followers_followers_user_idTousers: {
          take: 20,
          skip: page * 20,
          include: {
            users_followers_follower_user_idTousers: true,
          },
        }, ...HandleBlocks.getIncludeBlockInfo(target),}
      })

    // If the user is blocked then don't get anything for them
    if (target != req.userId) {
      // Check if the user is blocked or the other way round
      const isBlocked = HandleBlocks.checkIsBlocked(followerUsersRaw);
      if (isBlocked) {
        throw Error("Target user has been blocked by you or has blocked you");
      }
    }

    const followerUsers = followerUsersRaw?.followers_followers_user_idTousers;


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
}));

// Define a route to retrieve a user's following users
router.get("/following", ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);


    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if(req.headers.user && req.headers.user instanceof String) {
      target = BigInt(req.headers.user as string);
    }
    // Retrieve the list of followed users for the target user
    const followedUsersRaw = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        following_following_user_idTousers: {
          take: 20,
          skip: page * 20,
          include: {
            users_following_following_user_idTousers: true,
          },
        },
        ...HandleBlocks.getIncludeBlockInfo(target),
      },
    });

    // If the user is blocked then don't get anything for them
    if (target != req.userId) {
      // Check if the user is blocked or the other way round
      const isBlocked = HandleBlocks.checkIsBlocked(followedUsersRaw);
      if (isBlocked) {
        throw Error("Target user has been blocked by you or has blocked you");
      }
    }
    const followedUsers = followedUsersRaw?.following_following_user_idTousers;

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
}));

// Define a route to retrieve a user's friends
router.get("/friends", ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if(req.headers.user && req.headers.user instanceof String) {
      target = BigInt(req.headers.user as string);
    }
    const pageSize = 20;

    // Use a transaction to retrieve a combined list of user1's and user2's friends
    prisma.$transaction(async (tx) => {
      try {
        const user1Friends = await tx.users.findUnique({
          where: { user_id: target },
          include: {
            friends_friends_user1_idTousers: {
              take: pageSize,
              skip: page * pageSize,
              include: {
                users_friends_user2_idTousers: true,
              },
            },
          },
        });

        const len =
          user1Friends == null
            ? 0
            : user1Friends.friends_friends_user1_idTousers.length;
        const user2Friends = await tx.users.findUnique({
          where: { user_id: target },
          include: {
            friends_friends_user2_idTousers: {
              take: pageSize - len,
              skip: Math.max(0, page * pageSize - len),
              include: {
                users_friends_user1_idTousers: true,
              },
            },
          },
        });

        // If the user is blocked then don't get anything for them
        if (target != req.userId) {
          const targetUser = await tx.users.findFirst({
            where: { user_id: target },
            include: HandleBlocks.getIncludeBlockInfo(req.userId!),
          });
          // Check if the user is blocked or the other way round
          const isBlocked = HandleBlocks.checkIsBlocked(targetUser);
          if (isBlocked) {
            throw Error(
              "Target user has been blocked by you or has blocked you"
            );
          }
        }

        let returningUsers = [];
        if (user1Friends != null) {
          for (let friendUser of user1Friends.friends_friends_user1_idTousers) {
            const friendUserData = friendUser.users_friends_user2_idTousers;
            returningUsers.push({
              user_id: friendUserData.user_id,
              avatar_id: friendUserData.avatar_id,
              description: friendUserData.description,
              public_profile: friendUserData.public_profile,
              country: friendUserData.country,
              username: friendUserData.username,
              display_name: friendUserData.display_name,
              user_role: friendUserData.user_role,
            });
          }
        }

        if (user2Friends != null) {
          for (let friendUser of user2Friends.friends_friends_user2_idTousers) {
            const friendUserData = friendUser.users_friends_user1_idTousers;
            returningUsers.push({
              user_id: friendUserData.user_id,
              avatar_id: friendUserData.avatar_id,
              description: friendUserData.description,
              public_profile: friendUserData.public_profile,
              country: friendUserData.country,
              username: friendUserData.username,
              display_name: friendUserData.display_name,
              user_role: friendUserData.user_role,
            });
          }
        }

        return res.status(200).json(returningUsers);
      } catch (error) {
        // Handle any errors that occur during this process
        res.status(400).json({ error });
      }
    });
}));

router.patch("/follow", ...RouteBuilder.createRouteHandler(async (req, res) => { // Current user's ID
    const target = BigInt(req.body.user); // Target user's ID
    const accepted = req.body.accepted; // Whether the follow request is accepted

    // Find the follow request in the database
    const followRequest = await prisma.follow_requests.findFirst({
      where: { requester_id: target, requestee_id: req.userId },
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
          user_id: req.userId!,
          timestamp: new Date().toISOString(),
        },
      });
      const followers = await prisma.followers.create({
        data: {
          follower_id: generator.nextId(),
          follower_user_id: req.userId!,
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
}));

// This is a route handler for a PATCH request to "/friend".
router.patch("/friend", ...RouteBuilder.createRouteHandler(async (req, res) => {

    // Extract the target user's ID from the request body.
    const target = BigInt(req.body.user);

    // Delete any existing friend requests between the current user and the target user.
    const request = await prisma.friend_requests.deleteMany({
      where: { requestee_id: req.userId, requester_id: target },
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
          user1_id: req.userId!,
          user2_id: target,
          timestamp: new Date().toISOString(),
        },
      });
      return res.status(200).json({ success: true, accepted: true });
    } else {
      // If the "accepted" flag is not set, return a response indicating that the request was not accepted.
      return res.status(200).json({ success: true, accepted: false });
    }
}));

export default router;
