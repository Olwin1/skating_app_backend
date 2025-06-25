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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId);

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
        await TransactionHandler.createTransactionArray(prisma, [
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
        requestee_id: InvalidIdError.convertToBigInt(req.body.user, req.userId),
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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId);

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
      await TransactionHandler.createTransactionArray(prisma, [
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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId);

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
      await TransactionHandler.createTransactionArray(prisma, [
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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId);

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

// Define a route to retrieve a user's followers with friendship and friend request info
router.get(
  "/followers",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Parse and validate the pagination page number from request headers
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Determine the target user ID:
    // - By default, use the authenticated user's ID (req.userId)
    // - If a specific user ID is passed in the headers, validate and convert it to BigInt
    let target = req.userId!;
    if (req.headers.user && req.headers.user instanceof String) {
      target = InvalidIdError.convertToBigInt(req.headers.user, req.userId);
    }

    // Query the database for the target user and their followers
    // Includes up to 20 followers (pagination applied), and some additional block info
    const followerUsersRaw = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        followers_followers_user_idTousers: {
          take: 20, // Limit results per page
          skip: page * 20, // Skip pages * 20 for pagination
          include: {
            users_followers_follower_user_idTousers: true, // Include follower user data
          },
        },
        ...HandleBlocks.getIncludeBlockInfo(target), // Include blocking info for later checks
      },
    });

    // Throw an error if the target user does not exist
    UserNotFoundError.throwIfNull(
      followerUsersRaw,
      UserNotFoundError.targetUserMessage
    );

    // If the target is someone other than the requester,
    // check if either user has blocked the other and throw an error if so
    if (target != req.userId) {
      UserBlockedError.throwIfBlocked(
        HandleBlocks.checkIsBlocked(followerUsersRaw)
      );
    }

    // Extract the list of follower records (may be empty)
    const followerUsers =
      followerUsersRaw!.followers_followers_user_idTousers ?? [];

    // Extract follower user IDs to query friendship and friend request status
    const followerIds = followerUsers.map(
      (f) => f.users_followers_follower_user_idTousers.user_id
    );

    // Parallel queries:
    // 1) Find all friendships between the requester and any of the followers
    // 2) Find all friend requests either sent or received by the requester involving any of the followers
    const [friendRecords, friendRequestRecords] = await Promise.all([
      prisma.friends.findMany({
        where: {
          OR: [
            { user1_id: req.userId, user2_id: { in: followerIds } },
            { user2_id: req.userId, user1_id: { in: followerIds } },
          ],
        },
      }),
      prisma.friend_requests.findMany({
        where: {
          OR: [
            { requester_id: req.userId, requestee_id: { in: followerIds } },
            { requestee_id: req.userId, requester_id: { in: followerIds } },
          ],
        },
      }),
    ]);

    // Defensive check - throw error if no followers found (optional)
    if (followerUsers == null) {
      throw new Error("No followed users found");
    }

    // Prepare the array to return the processed follower data
    let returningUsers = [];

    // Loop through each follower to enrich their info with friendship/request status
    for (let followerUser of followerUsers) {
      const user = followerUser.users_followers_follower_user_idTousers;
      const followerId = user.user_id;

      // Check if follower is a confirmed friend of the requester
      const isFriend = friendRecords.some(
        (fr) =>
          (fr.user1_id === req.userId && fr.user2_id === followerId) ||
          (fr.user2_id === req.userId && fr.user1_id === followerId)
      );

      // Find any friend request involving the follower and requester
      const friendRequest = friendRequestRecords.find(
        (request) =>
          (request.requester_id === req.userId &&
            request.requestee_id === followerId) ||
          (request.requestee_id === req.userId &&
            request.requester_id === followerId)
      );

      // Initialize friend request direction flags
      let requestedOutgoing = false; // Friend request sent by requester to follower
      let requestedIncoming = false; // Friend request sent by follower to requester

      // Set the direction flags if a friend request exists
      if (friendRequest) {
        if (friendRequest.requester_id === req.userId) {
          requestedOutgoing = true;
        } else {
          requestedIncoming = true;
        }
      }

      // Add this follower's data and friendship/request info to the response array
      returningUsers.push({
        user_id: user.user_id,
        avatar_id: user.avatar_id,
        description: user.description,
        public_profile: user.public_profile,
        country: user.country,
        username: user.username,
        display_name: user.display_name,
        user_role: user.user_role,
        user_friends: {
          friends: isFriend,
          requestedOutgoing: requestedOutgoing,
          requestedIncoming: requestedIncoming,
        },
      });
    }

    // Respond with enriched list of followers including friend status info
    return res.status(200).json(returningUsers);
  })
);

router.get(
  "/following",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract and validate the pagination header, defaulting if null or invalid
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Determine the target user whose "following" list is to be fetched.
    // Default is the currently authenticated user (req.userId)
    let target = req.userId!;
    if (req.headers.user && req.headers.user instanceof String) {
      // If a specific user is passed in headers, convert it to BigInt safely
      target = InvalidIdError.convertToBigInt(req.headers.user, req.userId);
    }

    // Query the database for the target user's "following" list, with pagination
    // Also includes block-related information via a helper
    const followedUsersRaw = await prisma.users.findUnique({
      where: { user_id: target },
      include: {
        following_following_user_idTousers: {
          take: 20, // Limit results for pagination
          skip: page * 20, // Skip based on page number
          include: {
            // Include full user data for each followed user
            users_following_following_user_idTousers: true,
          },
        },
        ...HandleBlocks.getIncludeBlockInfo(target), // Include blocking info if needed
      },
    });

    // If the target user doesn't exist, throw a "user not found" error
    UserNotFoundError.throwIfNull(
      followedUsersRaw,
      UserNotFoundError.targetUserMessage
    );

    // If the requester is viewing someone else's following list,
    // Check if the target has blocked them
    if (target != req.userId) {
      UserBlockedError.throwIfBlocked(
        HandleBlocks.checkIsBlocked(followedUsersRaw)
      );
    }

    // Extract the list of followed user entries or fallback to empty array
    const followedUsers =
      followedUsersRaw!.following_following_user_idTousers ?? [];

    // Extract just the user IDs of those being followed
    const followedIds = followedUsers.map(
      (f) => f.users_following_following_user_idTousers.user_id
    );

    // Query both friendships and friend requests between the requester and followed users
    const [friendRecords, friendRequestRecords] = await Promise.all([
      prisma.friends.findMany({
        where: {
          OR: [
            { user1_id: req.userId, user2_id: { in: followedIds } },
            { user2_id: req.userId, user1_id: { in: followedIds } },
          ],
        },
      }),
      prisma.friend_requests.findMany({
        where: {
          OR: [
            { requester_id: req.userId, requestee_id: { in: followedIds } },
            { requestee_id: req.userId, requester_id: { in: followedIds } },
          ],
        },
      }),
    ]);

    // Build the final list of users to return, enriched with friendship status
    let returningUsers = [];

    for (let followedUser of followedUsers) {
      const user = followedUser.users_following_following_user_idTousers;
      const followedId = user.user_id;

      // Check if there's an existing friendship with the followed user
      const isFriend = friendRecords.some(
        (fr) =>
          (fr.user1_id === req.userId && fr.user2_id === followedId) ||
          (fr.user2_id === req.userId && fr.user1_id === followedId)
      );

      // Check if there's a friend request between requester and followed user
      const friendRequest = friendRequestRecords.find(
        (request) =>
          (request.requester_id === req.userId &&
            request.requestee_id === followedId) ||
          (request.requestee_id === req.userId &&
            request.requester_id === followedId)
      );

      // Track the direction of any friend requests
      let requestedOutgoing = false;
      let requestedIncoming = false;

      if (friendRequest) {
        if (friendRequest.requester_id === req.userId) {
          requestedOutgoing = true;
        } else {
          requestedIncoming = true;
        }
      }

      // Construct the user object to be returned
      returningUsers.push({
        user_id: user.user_id,
        avatar_id: user.avatar_id,
        description: user.description,
        public_profile: user.public_profile,
        country: user.country,
        username: user.username,
        display_name: user.display_name,
        user_role: user.user_role,
        user_friends: {
          friends: isFriend,
          requestedOutgoing: requestedOutgoing,
          requestedIncoming: requestedIncoming,
        },
      });
    }

    // Return the result with HTTP 200 OK
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
      target = InvalidIdError.convertToBigInt(req.headers.user, req.userId);
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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId); // Target user's ID
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
      await TransactionHandler.createTransactionArray(prisma, [
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
    const target = InvalidIdError.convertToBigInt(req.body.user, req.userId);

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
