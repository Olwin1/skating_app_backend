require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import HandleBlocks from "../utils/handleBlocks";

import RouteBuilder from "../utils/RouteBuilder";
import CheckNulls from "../utils/checkNulls";
import UserNotFoundError from "../Exceptions/Client/UserNotFoundError";
import UserBlockedError from "../Exceptions/Client/UserBlockedError";
import InvalidIdError from "../Exceptions/Client/InvalidIdError";
import TransactionHandler from "../utils/transactionHandler";
import ClientError from "../Exceptions/Client/ClientError";

const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// Define a route that allows a user to follow another user
router.post(
  "/follow",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the target user's ID from the request
    const target = InvalidIdError.convertToBigInt(req.body.user);

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

    // Check if the target user was found.
    UserNotFoundError.throwIfNull(
      targetUser,
      UserBlockedError.targetUserMessage
    );

    // Check if the user is blocked or the other way round
    UserBlockedError.throwIfBlocked(HandleBlocks.checkIsBlocked(targetUser));

    // Check if a follow request already exists
    if (
      targetUser!.follow_requests_follow_requests_requester_idTousers.length !=
      0
    ) {
      console.log("Follow request already exists.");
    } else {
      // If no follow request exists, check if the target user's profile is public
      if (targetUser!.public_profile == false) {
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

        // Run Prisma query within transaction
        await TransactionHandler.createTransaction(prisma, [
          prisma.following.create({ data: followingData }),
          prisma.followers.create({ data: followerData }),
        ]);
        // TODO change response to a default
        return res.status(200).json({ success: true, requested: false });
      }
    }
  })
);

// Define a route for sending a friend request
router.post(
  "/friend",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const targetUser = await prisma.users.findFirst({
      where: { user_id: req.body.user },
      include: HandleBlocks.getIncludeBlockInfo(req.userId!),
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      targetUser,
      UserNotFoundError.targetUserMessage
    );

    // Check if the user is blocked or the other way round
    UserBlockedError.throwIfBlocked(HandleBlocks.checkIsBlocked(targetUser));

    // Create a friend request
    const friendRequest = await prisma.friend_requests.create({
      data: {
        request_id: generator.nextId(),
        requester_id: req.userId!,
        requestee_id: InvalidIdError.convertToBigInt(req.body.user),
        timestamp: new Date().toISOString(),
      },
    });
    return res.status(200).json({ success: true });
  })
);

// Define a route for unfollowing a user
router.post(
  "/unfollow",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the target user's ID from the request
    const target = InvalidIdError.convertToBigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: req.userId, requestee_id: target },
        },
      },
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      targetUser,
      UserNotFoundError.targetUserMessage
    );

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
      // Run within a transaction to cancel if errors occur.
      await TransactionHandler.createTransaction(prisma, [
        prisma.following.deleteMany({
          where: { following_user_id: target, user_id: req.userId },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: req.userId, user_id: target },
        }),
      ]);
      return res.status(200).json({ success: true, requested: false });
    }
  })
);

// Define a route for unfollowing a user as the follower
router.post(
  "/unfollower",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the target user's ID from the request
    const target = InvalidIdError.convertToBigInt(req.body.user);

    // Retrieve information about the target user, including follow requests
    const targetUser = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        follow_requests_follow_requests_requester_idTousers: {
          where: { requester_id: target, requestee_id: req.userId },
        },
      },
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      targetUser,
      UserNotFoundError.targetUserMessage
    );

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
      await TransactionHandler.createTransaction(prisma, [
        prisma.following.deleteMany({
          where: { following_user_id: req.userId, user_id: target },
        }),
        prisma.followers.deleteMany({
          where: { follower_user_id: target, user_id: req.userId },
        }),
      ]);
      return res.status(200).json({ success: true, request: false });
    }
  })
);

// Define a route for unfriending a user
router.post(
  "/unfriend",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the target user's ID from the request
    const target = InvalidIdError.convertToBigInt(req.body.user);

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

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      friendInfo,
      UserNotFoundError.targetUserMessage
    );

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
  })
);

// Define a route to retrieve a user's followers
router.get(
  "/followers",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if (req.headers.user && req.headers.user instanceof String) {
      target = InvalidIdError.convertToBigInt(req.headers.user);
    }
    // Retrieve the list of follower users for the target user
    const followerUsersRaw = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        followers_followers_user_idTousers: {
          take: 20,
          skip: page * 20,
          include: {
            users_followers_follower_user_idTousers: true,
          },
        },
        ...HandleBlocks.getIncludeBlockInfo(target),
      },
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      followerUsersRaw,
      UserNotFoundError.targetUserMessage
    );

    // If the user is blocked then don't get anything for them
    if (target != req.userId) {
      // Check if the user is blocked or the other way round
      UserBlockedError.throwIfBlocked(
        HandleBlocks.checkIsBlocked(followerUsersRaw)
      );
    }

    const followerUsers = followerUsersRaw!.followers_followers_user_idTousers;

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
  })
);

// Define a route to retrieve a user's following users
router.get(
  "/following",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if (req.headers.user) {
      target = InvalidIdError.convertToBigInt(req.headers.user);
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

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      followedUsersRaw,
      UserNotFoundError.targetUserMessage
    );

    // If the user is blocked then don't get anything for them
    if (target != req.userId) {
      // Check if the user is blocked or the other way round
      UserBlockedError.throwIfBlocked(
        HandleBlocks.checkIsBlocked(followedUsersRaw)
      );
    }
    const followedUsers = followedUsersRaw!.following_following_user_idTousers;

    let returningUsers = [];

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
  })
);

// Define a route to retrieve a user's friends
router.get(
  "/friends",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Extract the target user's ID from the request headers (or use the user's own ID)
    let target = req.userId!;
    if (req.headers.user) {
      target = InvalidIdError.convertToBigInt(req.headers.user);
    }
    const pageSize = 20;

    // Retrieve a combined list of user1's and user2's friends
    const user1Friends = await prisma.users.findUnique({
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
    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      user1Friends,
      UserNotFoundError.targetUserMessage
    );

    const len = user1Friends!.friends_friends_user1_idTousers.length;
    const user2Friends = await prisma.users.findUnique({
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
    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      user2Friends,
      UserNotFoundError.targetUserMessage
    );

    // If the user is blocked then don't get anything for them
    if (target != req.userId) {
      const targetUser = await prisma.users.findFirst({
        where: { user_id: target },
        include: HandleBlocks.getIncludeBlockInfo(req.userId!),
      });
      // Check if the target user was found.  If not then throw an error to reflect that.
      UserNotFoundError.throwIfNull(
        targetUser,
        UserNotFoundError.targetUserMessage
      );

      // Check if the user is blocked or the other way round
      UserBlockedError.throwIfBlocked(HandleBlocks.checkIsBlocked(targetUser));
    }

    let returningUsers = [];
    for (let friendUser of user1Friends!.friends_friends_user1_idTousers) {
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

    for (let friendUser of user2Friends!.friends_friends_user2_idTousers) {
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

    return res.status(200).json(returningUsers);
  })
);

router.patch(
  "/follow",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Current user's ID
    const target = InvalidIdError.convertToBigInt(req.body.user); // Target user's ID
    const accepted = req.body.accepted; // Whether the follow request is accepted

    // Find the follow request in the database
    const followRequest = await prisma.follow_requests.findFirst({
      where: { requester_id: target, requestee_id: req.userId },
    });

    if (!followRequest) {
      // TODO handle error proper
      throw new ClientError("No follow request has been made.");
    }
    const deleteRequestData = {
      where: { request_id: followRequest!.request_id },
    };

    // If the request is accepted, create records in 'following' and 'followers' tables & delete follow request
    if (accepted) {
      // Run Prisma query within transaction
      await TransactionHandler.createTransaction(prisma, [
        prisma.follow_requests.delete(deleteRequestData),
        prisma.following.create({
          data: {
            following_id: generator.nextId(),
            following_user_id: target,
            user_id: req.userId!,
            timestamp: new Date().toISOString(),
          },
        }),
        prisma.followers.create({
          data: {
            follower_id: generator.nextId(),
            follower_user_id: req.userId!,
            user_id: target,
            timestamp: new Date().toISOString(),
          },
        }),
      ]);

      // Respond with success and acceptance status
      return res.status(200).json({ success: true, accepted: true });
    } else {
      await prisma.follow_requests.delete(deleteRequestData);
    }

    // If the request is not accepted, respond with success and rejection status
    return res.status(200).json({ success: true, accepted: false });
  })
);

// This is a route handler for a PATCH request to "/friend".
router.patch(
  "/friend",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the target user's ID from the request body.
    const target = InvalidIdError.convertToBigInt(req.body.user);

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
  })
);

export default router;
