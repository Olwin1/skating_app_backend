require("dotenv").config(); // Load .env variables
import { Router } from "express"; // Import router from express
import bcrypt from "bcryptjs"; // Import bcrypt to hash passwords
import jwt from "jsonwebtoken"; // Import jwt to sign tokens
import prisma from "../db/postgres"; // Import Prisma ORM for database operations
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import validator from "validator";
import { ErrorCode } from "../ErrorCodes";
import * as securePin from "secure-pin";
import { $Enums } from "@prisma/client";
import HandleBlocks from "../utils/handleBlocks";
import { CustomRequest } from "express-override";
import RouteBuilder from "../utils/RouteBuilder";
import UserNotFoundError from "../Exceptions/Client/UserNotFoundError";
import InvalidIdError from "../Exceptions/Client/InvalidIdError";
import crypto from "crypto";
import EmailService from "../services/emailer";
const router = Router(); // Create a router to create a route bundle

// Destructure environment variables with defaults
const { SECRET = "secret", EMAIL_VERIFICATION_CODE_LENGTH = "8" } = process.env;

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// User Authentication Endpoints
// These endpoints are used to authorize and authenticate users



// Method to generate a secure code to be used to verify an email address
function generateSecureNumericCode() {
  let length = 8;

    const result = parseInt(EMAIL_VERIFICATION_CODE_LENGTH);
    if(result > 0) {
      length = result;
    }
  const max = Math.pow(10, length);
  let code;
    code = crypto.randomInt(0, max);
  return code.toString().padStart(length, "0");;
}


router.post("/signup", async (req: CustomRequest, res) => {
  try {
    //TODO add link for html button

    // Check if the email is valid
    const isEmail = validator.isEmail(req.body.email);
    // Check if the password meets length requirements
    const isValidPassword = validator.isLength(req.body.password, {
      min: 8,
      max: 100,
    });
    // Check if the username meets length requirements
    const isValidUsername = validator.isLength(req.body.username, {
      min: 4,
      max: 24,
    });

    if (!isEmail) {
      // Return a 400 Bad Request response with an error code for an invalid email
      return res.status(400).json({ ec: ErrorCode.InvalidEmail });
    } else if (!isValidPassword) {
      // Return a 400 Bad Request response with an error code for an invalid password
      return res.status(400).json({ ec: ErrorCode.InvalidPassword });
    } else if (!isValidUsername) {
      // Return a 400 Bad Request response with an error code for an invalid username
      return res.status(400).json({ ec: ErrorCode.InvalidUsername });
    }

    // Hash the user's password
    let passwordHash = await bcrypt.hash(req.body.password, 10);

    // Generate a unique user ID
    let userId = generator.nextId();
    // Generate a secure pin code
    const verifCode = generateSecureNumericCode();

    // // Create a new user in the database using Prisma
    // const data = await prisma.users.create({
    //   data: {
    //     user_id: userId,
    //     username: req.body.username,
    //     password_hash: passwordHash,
    //     email: req.body.email,
    //     email_verifications: {
    //       create: {
    //         verification_id: generator.nextId(),
    //         verification_code: verifCode,
    //         is_verified: false,
    //         expiry_timestamp: new Date(Date.now() + 8.64e7), // Expires in a day
    //       },
    //     },
    //     email_notifications: false,
    //     dyslexia_font: false,
    //     public_profile: true,
    //     hide_location: false,
    //     analytics_enabled: true,
    //     user_role: $Enums.user_role.regular,
    //     created_at: new Date().toISOString(),
    //   },
    // });
    EmailService.getInstance().sendVerificationEmail(req.body.email, verifCode);

    // Return a 201 Created response for successful user registration
    res.status(201).json({ success: true });
  } catch (error) {
    // Return a 400 Bad Request response with the error if something went wrong
    res.status(400).json({ error });
  }
});

router.post("/login", async (req: CustomRequest, res) => {
  try {
    // Check if the password meets length requirements
    const isValidPassword = validator.isLength(req.body.password, {
      min: 8,
      max: 100,
    });
    // Check if the username meets length requirements
    const isValidUsername = validator.isLength(req.body.username, {
      min: 4,
      max: 24,
    });

    if (!isValidPassword) {
      // Return a 400 Bad Request response with an error code for an invalid password
      return res.status(400).json({ ec: ErrorCode.InvalidPassword });
    } else if (!isValidUsername) {
      // Return a 400 Bad Request response with an error code for an invalid username
      return res.status(400).json({ ec: ErrorCode.InvalidUsername });
    }

    // Find a user in the database by their username
    const user = await prisma.users.findFirst({
      where: { username: req.body.username },
    });

    // TODO obscure this so username or password could be incorrect

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(user, UserNotFoundError.selfUserMessage);

    // Compare the provided password with the hashed password stored in the database
    const result = await bcrypt.compare(
      req.body.password,
      user!.password_hash!
    );
    if (result) {
      const verified = await prisma.email_verifications.findFirst({
        where: { user_id: user!.user_id },
      });
      const isVerified = verified?.is_verified ?? false;

      // If the user is not yet verified then return a 403 - forbidden response
      if (!verified) {
        return res.status(403).json({
          ec: ErrorCode.EmailNotVerified,
          message:
            "Email not verified. Please verify your email before logging in.",
          user_id: user!.user_id.toString(),
        });
      }

      // If the passwords match, generate a JWT token and return it in the response
      const token = jwt.sign(
        { username: user!.username, userId: user!.user_id },
        SECRET
      );
      return res.status(200).json({
        token: token,
        user_id: user!.user_id.toString(),
      });
    } else {
      // Return a 400 Bad Request response with an error code for an incorrect password
      res.status(400).json({ ec: ErrorCode.IncorrectPassword });
    }
  } catch (error) {
    // Return a 400 Bad Request response with the error if something went wrong
    res.status(400).json({ error });
  }
});

// End of User Authentication Endpoints

// Define route handlers for various user-related operations

// Define a route for updating user descriptions
router.post(
  "/description",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Update the user's description in the database using Prisma
    const updatedUser = await prisma.users.update({
      where: { user_id: req.userId },
      data: { description: req.body.description },
    });

    // Send a success response with a JSON object
    res.status(200).json({ success: true });
  })
);

// Define a route for updating user avatars
router.post(
  "/avatar",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Update the user's avatar in the database using Prisma
    const updatedUser = await prisma.users.update({
      where: { user_id: req.userId },
      data: { avatar_id: req.body.avatar },
    });

    // Send a success response with a JSON object
    res.status(200).json({ success: true });
  })
);

// Route handler to update user's email
router.post(
  "/email",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Update the user's email in the database
    //TODO: Redo Email Verification
    const updatedUser = await prisma.users.update({
      where: { user_id: req.userId },
      data: { email: req.body.description },
    });
    await prisma.email_verifications.deleteMany({
      where: { user_id: req.userId },
    });

    // Return the response from the database update
    res.status(200).json({ success: true, verified: false });
  })
);

// Route handler to update user's email verification
router.post(
  "/verify_email",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Update the user's email in the database
    const emailVerification = await prisma.email_verifications.findFirst({
      where: {
        user_id: req.userId,
        expiry_timestamp: { gt: new Date() },
        verification_code: req.body.code,
      },
    });
    if (emailVerification != null) {
      const updatedUser = await prisma.email_verifications.update({
        where: { verification_id: emailVerification.verification_id },
        data: { is_verified: true },
      });
      // Return the response from the database update
      res.status(200).json({ success: true, verified: false });
    } else {
      res.status(400).json({ success: false, verified: false });
    }
  })
);
// Route handler to update user's email
router.get(
  "/is_verified",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Update the user's email in the database
    const verified = await prisma.email_verifications.findFirst({
      where: { user_id: req.userId, is_verified: true },
    });

    // Return the response from the database update
    res
      .status(200)
      .json({ success: true, verified: verified?.is_verified ?? false });
  })
);

// Route handler to check if user is allowed to access app
router.get(
  "/is_restricted",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const isRestrictedData = await prisma.user_actions.findMany({
      where: {
        user_id: req.userId,
        AND: [
          {
            OR: [
              { action_type: $Enums.user_action_type.ban },
              { action_type: $Enums.user_action_type.mute },
            ],
          },
          {
            OR: [
              { end_timestamp: { gte: new Date(Date.now()) } },
              { end_timestamp: null },
            ],
          },
        ],
      },
    });

    let isBanned = false;
    let isMuted = false;
    let endTimestamp: Date | null = new Date(0);
    for (let i = 0; i < isRestrictedData.length; i++) {
      if (
        !isBanned &&
        isRestrictedData[i].action_type == $Enums.user_action_type.mute
      ) {
        isMuted = true;
        endTimestamp = isRestrictedData[i].end_timestamp;
      } else if (
        endTimestamp &&
        isRestrictedData[i].action_type == $Enums.user_action_type.ban
      ) {
        if (
          endTimestamp &&
          (isRestrictedData[i].end_timestamp == null ||
            endTimestamp < isRestrictedData[i].end_timestamp!)
        ) {
          isBanned = true;
          endTimestamp = isRestrictedData[i].end_timestamp;
          if (endTimestamp == null) {
            break;
          }
        }
      }
    }

    // Return the response from the database update
    //res.status(200).json({ "is_banned": isBanned, "is_muted": isMuted, "end_timestamp": endTimestamp});
    res.status(200).json({
      is_banned: isBanned,
      is_muted: isMuted,
      end_timestamp: endTimestamp,
    });
  })
);

// Retrieves user id.
router.get(
  "/id",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Retrieve user information from the database based on the user_id provided in the request headers.
    const user = await prisma.users.findUnique({
      where: {
        user_id: req.userId,
      },
      select: { user_id: true },
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(user, UserNotFoundError.targetUserMessage);

    // Send a JSON response with the user information.
    return res.status(200).json({ user_id: user!.user_id });
  })
);

// Retrieves user information.
router.get(
  "/",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    if (Array.isArray(req.headers.id)) {
      throw TypeError("Expected id to be of type `string` not `string[]`");
    } else if (!req.headers.id) {
      throw new InvalidIdError("Expected an id argument");
    }

    let bigIntUserId = InvalidIdError.convertToBigInt(
      req.headers.id,
      req.userId
    );

    // Retrieve user information from the database based on the user_id provided in the request headers.
    const user = await prisma.users.findUnique({
      where: {
        user_id: bigIntUserId,
      },
      include: {
        _count: {
          select: {
            followers_followers_user_idTousers: true,
            following_following_user_idTousers: true,
            friends_friends_user1_idTousers: true,
            friends_friends_user2_idTousers: true,
            posts: true,
          },
        },
        ...HandleBlocks.getIncludeBlockInfo(req.userId!),
      },
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(user, UserNotFoundError.targetUserMessage);

    let returnUser = {};

    // Depending on the user_id, construct a response object with different fields.
    // If it is logged in user return more data
    if (user!.user_id == req.userId) {
      returnUser = {
        user_id: user!.user_id,
        avatar_id: user!.avatar_id,
        description: user!.description,
        email: user!.email,
        email_notifications: user!.email_notifications,
        dyslexia_font: user!.dyslexia_font,
        public_profile: user!.public_profile,
        hide_location: user!.hide_location,
        analytics_enabled: user!.analytics_enabled,
        background: user!.background,
        country: user!.country,
        username: user!.username,
        display_name: user!.display_name,
        user_role: user!.user_role,
        followers: user!._count.followers_followers_user_idTousers,
        following: user!._count.following_following_user_idTousers,
        friends:
          user!._count.friends_friends_user1_idTousers +
          user!._count.friends_friends_user2_idTousers,
        posts: user!._count.posts,
      };
    } else {
      const follows = await checkUserFollows(req.userId!, user!.user_id);
      const friends = await checkUserFriends(req.userId!, user!.user_id);
      returnUser = {
        user_id: user!.user_id,
        avatar_id: user!.avatar_id,
        description: user!.description,
        public_profile: user!.public_profile,
        country: user!.country,
        username: user!.username,
        display_name: user!.display_name,
        user_role: user!.user_role,
        followers: user!._count.followers_followers_user_idTousers,
        following: user!._count.following_following_user_idTousers,
        friends:
          user!._count.friends_friends_user1_idTousers +
          user!._count.friends_friends_user2_idTousers,
        posts: user!._count.posts,
        user_follows: follows,
        user_friends: friends,
        // Check if user is blocked by requester or not
        blocked: HandleBlocks.checkIsBlocked(user),
      };
    }

    // Send a JSON response with the user information.
    return res.status(200).json(returnUser);
  })
);

// This is another route handler for "/follows" that checks if a user is following another user.
router.get(
  "/follows",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    if (Array.isArray(req.headers.user)) {
      throw TypeError("Expected user to be of type `string` not `string[]`");
    } else if (!req.headers.user) {
      throw new InvalidIdError("Expected a user argument");
    }
    return res
      .status(200)
      .json(
        await checkUserFollows(
          req.userId!,
          InvalidIdError.convertToBigInt(req.headers.user, req.userId)
        )
      );
  })
);

// Similar to the previous route handlers, this one checks if users are friends.
router.get(
  "/friends",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    if (Array.isArray(req.headers.user)) {
      throw TypeError("Expected user to be of type `string` not `string[]`");
    } else if (!req.headers.user) {
      throw new InvalidIdError("Expected a user argument");
    }
    return res
      .status(200)
      .json(
        await checkUserFollows(
          req.userId!,
          InvalidIdError.convertToBigInt(req.headers.user, req.userId)
        )
      );
  })
);

async function checkUserFollows(userId: bigint, targetUser: bigint) {
  // Check if the user is following the user specified in the request headers.
  const following = await prisma.following.findFirst({
    where: { user_id: userId, following_user_id: targetUser },
  });

  if (following) {
    // If the user is following, send a JSON response indicating "following" is true.
    return { following: true };
  } else {
    // If not following, check if there's a follow request and respond accordingly.
    const followingRequest = await prisma.follow_requests.findFirst({
      where: { requester_id: userId, requestee_id: targetUser },
    });
    if (followingRequest) {
      return { following: false, requested: true };
    } else {
      return { following: false, requested: false };
    }
  }
}

async function checkUserFriends(userId: bigint, targetUser: bigint) {
  // Check if the user is friends with the user specified in the request headers.
  const friends = await prisma.friends.findFirst({
    where: {
      OR: [
        { user1_id: userId, user2_id: targetUser },
        { user1_id: targetUser, user2_id: userId },
      ],
    },
  });

  if (friends) {
    return { friends: true };
  } else {
    const friendsRequestOutgoing = await prisma.friend_requests.findFirst({
      where: { requester_id: userId, requestee_id: targetUser },
    });
    if (friendsRequestOutgoing) {
      return { friends: false, requestedOutgoing: true };
    } else {
      const friendsRequestIncoming = await prisma.friend_requests.findFirst({
        where: { requester_id: targetUser, requestee_id: userId },
      });
      if (friendsRequestIncoming) {
        return { friends: false, requestedIncoming: true };
      } else {
        return { friends: false };
      }
    }
  }
}

// Another route handler for user search based on a query.
router.get(
  "/search",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    if (Array.isArray(req.headers.query)) {
      throw TypeError("Expected user to be of type `string` not `string[]`");
    } else if (!req.headers.query) {
      throw new Error("Expected a query argument");
    }
    // Search for users whose usernames contain the query specified in the request headers.
    const results = await prisma.users.findMany({
      where: {
        username: {
          contains: req.headers.query,
        },
      },
      include: HandleBlocks.getIncludeBlockInfo(req.userId!),
      take: 10,
    });

    const returns = [];
    for (let i = 0; i < results.length; i++) {
      //If is blocked then skip
      if (HandleBlocks.checkIsBlocked(results[i])) {
        continue;
      }

      const ret = {
        user_id: results[i].user_id,
        username: results[i].username,
        avatar_id: results[i].avatar_id,
      };
      returns.push(ret);
    }

    // Send a JSON response with the search results.
    return res.json(returns);
  })
);

// Route handler to block user
router.post(
  "/block",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const isAlreadyBlocked = await prisma.blocked_users.findFirst({
      where: {
        blocked_user_id: req.body.user,
        blocking_user_id: req.userId,
      },
    });
    if (!isAlreadyBlocked) {
      const blockedRecord = await prisma.blocked_users.create({
        data: {
          blocked_id: generator.nextId(),
          blocking_user_id: req.userId!,
          blocked_user_id: req.body.user,
          timestamp: new Date(Date.now()),
        },
      });
      // New record created so return 201 status with success
      return res.status(201).json({ success: true });
    } else {
      // Already blocking the user so return a 200 with success
      // TODO: Change to error later and add handler on client side
      return res.status(200).json({ success: true });
    }
  })
);

// Route handler to unblock user
router.post(
  "/unblock",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const blockedRecord = await prisma.blocked_users.deleteMany({
      where: {
        blocking_user_id: req.userId,
        blocked_user_id: req.body.user,
      },
    });
    return res.status(200).json({ success: true, count: blockedRecord.count });
  })
);

// Another route handler for user search based on a query.
router.get(
  "/blocked_users",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const pageSize = 10;
    const skip = pageSize * parseInt(req.headers.page as string);
    // Get all user records showing the users that the user has blocked
    const users = await prisma.blocked_users.findMany({
      where: {
        blocking_user_id: req.userId,
      },
      include: {
        users_blocked_users_blocked_user_idTousers: {
          select: {
            user_id: true,
            username: true,
            avatar_id: true,
          },
        },
      },
      take: pageSize,
      skip: skip,
    });

    const returns = [];
    for (let i = 0; i < users.length; i++) {
      // Loop through each record and add each user's user_id, username, and avatar_id to the array
      const ret = {
        user_id: users[i].users_blocked_users_blocked_user_idTousers.user_id,
        username: users[i].users_blocked_users_blocked_user_idTousers.username,
        avatar_id:
          users[i].users_blocked_users_blocked_user_idTousers.avatar_id,
      };
      returns.push(ret);
    }

    // Send a JSON response with the search results.
    return res.json(returns);
  })
);

export default router;
