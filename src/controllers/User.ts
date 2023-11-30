require("dotenv").config(); // Load .env variables
import { Router } from "express" // Import router from express
import bcrypt from "bcryptjs" // Import bcrypt to hash passwords
import jwt from "jsonwebtoken" // Import jwt to sign tokens
import middleware from "./middleware"; // Import custom middleware
import CustomRequest from "./CustomRequest"; // Import a custom request type
import prisma from "../db/postgres"; // Import Prisma ORM for database operations
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import validator from 'validator';
import { ErrorCode } from "../ErrorCodes";
import * as securePin from "secure-pin";
const router = Router(); // Create a router to create a route bundle

// Destructure environment variables with defaults
const { SECRET = "secret" } = process.env;

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// User Authentication Endpoints
// These endpoints are used to authorize and authenticate users

router.post("/signup", async (req: any, res) => {
  try {
    // Check if the email is valid
    const isEmail = validator.isEmail(req.body.email);
    // Check if the password meets length requirements
    const isValidPassword = validator.isLength(req.body.password, { min: 8, max: 100 });
    // Check if the username meets length requirements
    const isValidUsername = validator.isLength(req.body.username, { min: 4, max: 24 });

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
    const verifCode = securePin.generatePinSync(4);

    // Create a new user in the database using Prisma
    const data = await prisma.users.create({
      data: {
        user_id: userId,
        username: req.body.username,
        password_hash: passwordHash,
        email: req.body.email,
        email_verifications: {
          create: {
            verification_id: generator.nextId(),
            verification_code: verifCode,
            is_verified: false,
            expiry_timestamp: new Date(Date.now() + 8.64e+7),// Expires in a day
          }
        },
        created_at: new Date().toISOString(),
      },
    });


    // Return a 201 Created response for successful user registration
    res.status(201).json({ "success": true });
  } catch (error) {
    // Return a 400 Bad Request response with the error if something went wrong
    res.status(400).json({ error });
  }
});

router.post("/login", async (req: any, res) => {
  try {
    // Check if the password meets length requirements
    const isValidPassword = validator.isLength(req.body.password, { min: 8, max: 100 });
    // Check if the username meets length requirements
    const isValidUsername = validator.isLength(req.body.username, { min: 4, max: 24 });

    if (!isValidPassword) {
      // Return a 400 Bad Request response with an error code for an invalid password
      return res.status(400).json({ ec: ErrorCode.InvalidPassword });
    } else if (!isValidUsername) {
      // Return a 400 Bad Request response with an error code for an invalid username
      return res.status(400).json({ ec: ErrorCode.InvalidUsername });
    }

    // Find a user in the database by their username
    const user = await prisma.users.findFirst({ where: { username: req.body.username } });

    if (user) {
      // Compare the provided password with the hashed password stored in the database
      const result = await bcrypt.compare(req.body.password, user.password_hash!);
      if (result) {
        const verified = await prisma.email_verifications.findFirst({ where: { user_id: user.user_id, is_verified: true } })
        const isVerified = verified?.is_verified ?? false

        // If the passwords match, generate a JWT token and return it in the response
        const token = jwt.sign({ username: user.username, _id: user.user_id }, SECRET);
        return res.status(200).json({ "token": token, "verified": isVerified });
      } else {
        // Return a 400 Bad Request response with an error code for an incorrect password
        res.status(400).json({ ec: ErrorCode.IncorrectPassword });
      }
    } else {
      // Return a 400 Bad Request response with an error code for a user not found
      res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  } catch (error) {
    // Return a 400 Bad Request response with the error if something went wrong
    res.status(400).json({ error });
  }
});


// End of User Authentication Endpoints

// Define route handlers for various user-related operations

// Define a route for updating user descriptions
router.post("/description", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Update the user's description in the database using Prisma
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { description: req.body.description } });

    // Send a success response with a JSON object
    res.status(200).json({ "success": true });
  } catch (error) {
    // Send an error response with the error object
    res.status(400).json({ error });
  }
});

// Define a route for updating user avatars
router.post("/avatar", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    // Update the user's avatar in the database using Prisma
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { avatar_id: req.body.avatar } });

    // Send a success response with a JSON object
    res.status(200).json({ "success": true });
  } catch (error) {
    // Send an error response with the error object
    res.status(400).json({ error });
  }
});

// Route handler to update user's email
router.post("/email", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    // Update the user's email in the database 
    //TODO: Redo Email Verification
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { email: req.body.description } })
    await prisma.email_verifications.deleteMany({ where: { user_id: _id } })

    // Return the response from the database update
    res.status(200).json({ "success": true, "verified": false });
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Route handler to update user's email verification
router.post("/verify_email", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    // Update the user's email in the database
    const emailVerification = await prisma.email_verifications.findFirst({ where: { user_id: _id, expiry_timestamp: { gt: new Date() }, verification_code: req.body.code } })
    if (emailVerification != null) {
      const updatedUser = await prisma.email_verifications.update({ where: { verification_id: emailVerification.verification_id }, data: { is_verified: true } })
      // Return the response from the database update
      res.status(200).json({ "success": true, "verified": false });
    }
    else {
      res.status(400).json({ "success": false, "verified": false })
    }


  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});
// Route handler to update user's email
router.get("/is_verified", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Get the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);

    // Update the user's email in the database 
    const verified = await prisma.email_verifications.findFirst({ where: { user_id: _id, is_verified: true } })

    // Return the response from the database update
    res.status(200).json({ "success": true, "verified": verified?.is_verified ?? false });
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});



// Retrieves user information.
router.get("/", middleware.isLoggedIn, async (req: any, res) => {
  try {
    const _id = BigInt((req as CustomRequest).user._id);

    // Retrieve user information from the database based on the user_id provided in the request headers.
    const user = await prisma.users.findUnique({
      where: { user_id: (req.headers.id ?? "0") != "0" ? BigInt(req.headers.id) : _id },
      include: { _count: { select: { followers_followers_user_idTousers: true, following_following_user_idTousers: true, friends_friends_user1_idTousers: true, friends_friends_user2_idTousers: true, posts: true } } }
    });

    if (user) {
      let returnUser = {};

      // Depending on the user_id, construct a response object with different fields.
      // If it is logged in user return more data
      if (user.user_id == _id) {
        returnUser = {
          "user_id": user.user_id,
          "avatar_id": user.avatar_id,
          "description": user.description,
          "email": user.email,
          "email_notifications": user.email_notifications,
          "dyslexia_font": user.dyslexia_font,
          "public_profile": user.public_profile,
          "hide_location": user.hide_location,
          "analytics_enabled": user.analytics_enabled,
          "background": user.background,
          "country": user.country,
          "username": user.username,
          "display_name": user.display_name,
          "user_role": user.user_role,
          "followers": user._count.followers_followers_user_idTousers,
          "following": user._count.following_following_user_idTousers,
          "friends": user._count.friends_friends_user1_idTousers + user._count.friends_friends_user2_idTousers,
          "posts": user._count.posts
        };
      } else {
        returnUser = {
          "user_id": user.user_id,
          "avatar_id": user.avatar_id,
          "description": user.description,
          "public_profile": user.public_profile,
          "country": user.country,
          "username": user.username,
          "display_name": user.display_name,
          "user_role": user.user_role,
          "followers": user._count.followers_followers_user_idTousers,
          "following": user._count.following_following_user_idTousers,
          "friends": user._count.friends_friends_user1_idTousers + user._count.friends_friends_user2_idTousers,
          "posts": user._count.posts
        };
      }

      // Send a JSON response with the user information.
      return res.status(200).json(returnUser);
    } else {
      // If the user is not found, send a JSON response with an error code.
      res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }

  } catch (error) {
    // If an error occurs during the database query or processing, send an error response.
    res.status(400).json({ error });
  }
});

// This is another route handler for "/follows" that checks if a user is following another user.
router.get("/follows", middleware.isLoggedIn, async (req: any, res) => {
  try {
    const _id = BigInt((req as CustomRequest).user._id);

    // Check if the user is following the user specified in the request headers.
    const following = await prisma.following.findFirst({ where: { user_id: _id, following_user_id: BigInt(req.headers.user) } });

    if (following) {
      // If the user is following, send a JSON response indicating "following" is true.
      return res.json({ "following": true });
    } else {
      // If not following, check if there's a follow request and respond accordingly.
      const followingRequest = await prisma.follow_requests.findFirst({ where: { requester_id: _id, requestee_id: BigInt(req.headers.user) } });
      if (followingRequest) {
        return res.json({ "following": false, "requested": true });
      } else {
        return res.json({ "following": false, "requested": false });
      }
    }
  } catch (error) {
    // Handle and respond to any errors that occur during the process.
    res.status(400).json({ error });
  }
});

// Similar to the previous route handlers, this one checks if users are friends.
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {
  try {
    const _id = BigInt((req as CustomRequest).user._id);

    // Check if the user is friends with the user specified in the request headers.
    const friends = await prisma.friends.findFirst({ where: { OR: [{ user1_id: _id, user2_id: BigInt(req.headers.user) }, { user1_id: BigInt(req.headers.user), user2_id: _id }] } });

    if (friends) {
      return res.json({ "friends": true });
    } else {
      const friendsRequestOutgoing = await prisma.friend_requests.findFirst({ where: { requester_id: _id, requestee_id: BigInt(req.headers.user) } });
      if (friendsRequestOutgoing) {
        return res.json({ "friends": false, "requestedOutgoing": true });
      } else {
        const friendsRequestIncoming = await prisma.friend_requests.findFirst({ where: { requester_id: BigInt(req.headers.user), requestee_id: _id } });
        if (friendsRequestIncoming) {
          return res.json({ "friends": false, "requestedIncoming": true });
        } else {
          return res.json({ "friends": false });
        }
      }
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});

// Another route handler for user search based on a query.
router.get("/search", middleware.isLoggedIn, async (req: any, res) => {
  try {
    const _id = BigInt((req as CustomRequest).user._id);

    // Search for users whose usernames contain the query specified in the request headers.
    const results = await prisma.users.findMany({
      where: {
        username: {
          contains: req.headers.query,
        },
      },
      take: 10,
    });

    const returns = [];
    for (let i = 0; i < results.length; i++) {
      const ret = { "user_id": results[i].user_id, "username": results[i].username, "avatar_id": results[i].avatar_id };
      returns.push(ret);
    }

    // Send a JSON response with the search results.
    return res.json(returns);
  } catch (error) {
    // Handle and respond to any errors that occur during the search.
    res.status(400).json({ error });
  }
});



export default router;