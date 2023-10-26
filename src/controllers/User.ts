require("dotenv").config(); // Load .env variables
import { Router } from "express" // Import router from express
import bcrypt from "bcryptjs" // Import bcrypt to hash passwords
import jwt from "jsonwebtoken" // Import jwt to sign tokens
import middleware from "./middleware"; // Import custom middleware
import CustomRequest from "./CustomRequest"; // Import a custom request type
import prisma from "../db/postgres"; // Import Prisma ORM for database operations
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import validator from 'validator';
const router = Router(); // Create a router to create a route bundle

// Destructure environment variables with defaults
const { SECRET = "secret" } = process.env;

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const ec = "error_code";

// User Authentication Endpoints
// These endpoints are used to authorize and authenticate users

// Signup route to create a new user
router.post("/signup", async (req: any, res) => {
  //  try {
  const isEmail = validator.isEmail(req.body.email);
  const isValidPassword = validator.isLength(req.body.password, { min: 8, max: 100 })
  const isValidUsername = validator.isLength(req.body.username, { min: 4, max: 24 })
  if (!isEmail) {
    return res.status(400).json({ ec: 0x001 })
  }
  else if (!isValidPassword) {
    return res.status(400).json({ ec: 0x002 })
  }
  else if (!isValidUsername) {
    return res.status(400).json({ ec: 0x003 })
  }


  // Hash the user's password
  let passwordHash = await bcrypt.hash(req.body.password, 10);
  // Generate a unique user ID
  let userId = generator.nextId();

  // Create a new user using Prisma ORM
  const data = await prisma.users.create({
    data: {
      user_id: userId,
      username: req.body.username,
      password_hash: passwordHash,
      email: req.body.email,
      email_verifications: {
        create: {
          verification_id: generator.nextId(),
          verification_code: "1111",
          is_verified: false,
          expiry_timestamp: new Date(Date.now() + 8.64e+7), // Expires in a day
        }
      }
    },
  });
  // Send the newly created user as a response
  res.status(201).json({ "success": true });
  // } catch (error) {
  //   // If an error occurs, send a 400 Bad Request response with the error
  //   res.status(400).json({ error });
  // }
});

// Login route to verify a user and issue a token
router.post("/login", async (req: any, res) => {
  try {
    const isValidPassword = validator.isLength(req.body.password, { min: 8, max: 100 })
    const isValidUsername = validator.isLength(req.body.username, { min: 4, max: 24 })
    if (!isValidPassword) {
      return res.status(400).json({ ec: 0x004 })
    }
    else if (!isValidUsername) {
      return res.status(400).json({ ec: 0x005 })
    }


    // Check if the user exists
    const user = await prisma.users.findFirst({ where: { username: req.body.username } })
    if (user) {
      // Check if the password matches
      const result = await bcrypt.compare(req.body.password, user.password_hash!);
      if (result) {
        // Sign a token and send it in the response
        const token = await jwt.sign({ username: user.username, _id: user.user_id }, SECRET);
        return res.status(200).json({ token });
      } else {
        res.status(400).json({ ec: 0x007 });
      }
    } else {
      res.status(400).json({ ec: 0x006 });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});

// End of User Authentication Endpoints

// Define route handlers for various user-related operations

// Route handler to update user's description
router.post("/description", middleware.isLoggedIn, async (req: any, res) => {
  // Get the user ID from the request object
  const _id = BigInt((req as CustomRequest).user._id);

  try {
    // Update the user's description in the database
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { description: req.body.description } })

    // Return the response from the database update
    res.status(200).json({ "success": true })
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Route handler to update user's avatar
router.post("/avatar", middleware.isLoggedIn, async (req: any, res) => {
  // Get the user ID from the request object
  const _id = BigInt((req as CustomRequest).user._id);

  try {
    // Update the user's avatar in the database
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { avatar_id: req.body.avatar } })

    // Return the response from the database update
    res.status(200).json({ "success": true })
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Route handler to update user's email
router.post("/email", middleware.isLoggedIn, async (req: any, res) => {
  // Get the user ID from the request object
  const _id = BigInt((req as CustomRequest).user._id);

  try {
    // Update the user's email in the database (TODO: Redo Email Verification)
    const updatedUser = await prisma.users.update({ where: { user_id: _id }, data: { email: req.body.description } })

    // Return the response from the database update
    res.status(200).json({ "success": true });
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Route handler to get user information
router.get("/", middleware.isLoggedIn, async (req: any, res) => {
  // Get the user ID from the request object
  const _id = BigInt((req as CustomRequest).user._id);

  try {
    // Find the user in the database
    const user = await prisma.users.findUnique({ where: { user_id: req.headers.id != "0" ? BigInt(req.headers.id) : _id } })
    if (user) {
      let returnUser = {}
      // Return the response from the database query
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
          "user_role": user.user_role
        }
      }
      else {
        returnUser = {
          "user_id": user.user_id,
          "avatar_id": user.avatar_id,
          "description": user.description,
          "public_profile": user.public_profile,
          "country": user.country,
          "username": user.username,
          "display_name": user.display_name,
          "user_role": user.user_role
        }
      }
      return res.status(200).json(returnUser);
    } else {
      res.status(400).json({ ec: 0x006 });
    }

  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// GET route for getting the followers of a user
router.get("/follows", middleware.isLoggedIn, async (req: any, res) => {
  const _id = BigInt((req as CustomRequest).user._id);
  try {
    // Finding the Followers document with the specified user ID and owner ID
    const following = await prisma.following.findFirst({ where: { user_id: _id, following_user_id: BigInt(req.headers.user) } });
    if (following) {
      return res.json({ "following": true });
    }
    else {
      // Check if there is a follow request pending
      const followingRequest = await prisma.follow_requests.findFirst({ where: { requester_id: _id, requestee_id: BigInt(req.headers.user) } });
      if (followingRequest) {
        return res.json({ "following": false, "requested": true });
      }
      else {
        return res.json({ "following": false, "requested": false });
      }
    }
  } catch (error) {
    // Sending an error response if there's an error in finding the document
    res.status(400).json({ error });
  }
});


// GET route for getting the friends of a user
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {
  const _id = BigInt((req as CustomRequest).user._id);
  try {
    // Finding the Friends document with the specified user IDs
    const friends = await prisma.friends.findFirst({ where: { OR: [{ user1_id: _id, user2_id: BigInt(req.headers.user) }, { user1_id: BigInt(req.headers.user), user2_id: _id }] } });
    if (friends) {
      return res.json({ "friends": true });
    }
    else {
      // Check if there is an outgoing friend request
      const friendsRequestOutgoing = await prisma.friend_requests.findFirst({ where: { requester_id: _id, requestee_id: BigInt(req.headers.user) } });
      if (friendsRequestOutgoing) {
        return res.json({ "friends": false, "requestedOutgoing": true });
      }
      else {
        // Check if there is an incoming friend request
        const friendsRequestIncoming = await prisma.friend_requests.findFirst({ where: { requester_id: BigInt(req.headers.user), requestee_id: _id } });
        if (friendsRequestIncoming) {
          return res.json({ "friends": false, "requestedIncoming": true });
        }
        else {
          return res.json({ "friends": false });
        }
      }
    }
  } catch (error) {
    // Sending an error response if there's an error in finding the document
    res.status(400).json({ error });
  }
});


// GET route for searching for users
router.get("/search", middleware.isLoggedIn, async (req: any, res) => {
  const _id = BigInt((req as CustomRequest).user._id);
  try {
    // Finding users whose username contains the specified query
    const results = await prisma.users.findMany({
      where: {
        username: {
          contains: req.headers.query,
        },
      },
      take: 10, // Limit the number of results to 10
    });

    const returns = []
    for (let i = 0; i < results.length; i++) {
      const ret = { "_id": results[i].user_id, "username": results[i].username, "avatar": results[i].avatar_id };
      returns.push(ret);
    }
    // Sending the search results as a response
    return res.json(returns);
  } catch (error) {
    // Sending an error response if there's an error in finding the document
    res.status(400).json({ error });
  }
});



export default router;