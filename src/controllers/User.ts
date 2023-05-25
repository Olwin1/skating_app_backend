require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import bcrypt from "bcryptjs" // import bcrypt to hash passwords
import jwt from "jsonwebtoken" // import jwt to sign tokens
import middleware from "./middleware";

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;
////////////////////////////////////////////
//?USER AUTH ENDPOINTS                    //
//These endpoints are used to authorise a //
//user & allow access                     //
////////////////////////////////////////////
// Signup route to create a new user
router.post("/signup", async (req: any, res) => {
  const { User } = req.context.models;
  try {
    // hash the password
    req.body.password = await bcrypt.hash(req.body.password, 10);
    // create a new user
    const user = await User.create(req.body);
    // send new user as response
    res.json(user);
  } catch (error) {
    res.status(400).json({ error });
  }
});

// Login route to verify a user and get a token
router.post("/login", async (req: any, res) => {
  const { User } = req.context.models;
  try {
    // check if the user exists
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      //check if password matches
      const result = await bcrypt.compare(req.body.password, user.password);
      if (result) {
        // sign token and send it in response
        const token = await jwt.sign({ username: user.username, _id: user._id }, SECRET);
        res.json({ token });
      } else {
        res.status(400).json({ error: "password doesn't match" });
      }
    } else {
      res.status(400).json({ error: "User doesn't exist" });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});
///////////////////////////////////////////////////
//?END OF USER AUTH ENDPOINTS                    //
//These endpoints are used to authorise a        //
//user & allow access                            //
///////////////////////////////////////////////////


// Define a route handler to handle a POST request to "/description"
router.post("/description", middleware.isLoggedIn, async (req: any, res) => {

  // Get the user ID from the request object
  const { _id } = req.user;

  // Get the User model from the context object
  const { User } = req.context.models;

  try {
    // Update the user's description in the database
    let t = await User.updateOne({ "_id": _id }, { $set: { "description": req.body.description } })

    // Return the response from the database update
    res.json(t)
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});


// Define a route handler to handle a POST request to "/avatar"
router.post("/avatar", middleware.isLoggedIn, async (req: any, res) => {

  // Get the user ID from the request object
  const { _id } = req.user;

  // Get the User model from the context object
  const { User } = req.context.models;

  try {
    // Update the user's avatar in the database
    let t = await User.updateOne({ "_id": _id }, { $set: { "avatar": req.body.avatar } })

    // Return the response from the database update
    res.json(t)
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});


// Define a route handler to handle a POST request to "/email"
router.post("/email", middleware.isLoggedIn, async (req: any, res) => {

  // Get the user ID from the request object
  const { _id } = req.user;

  // Get the User model from the context object
  const { User } = req.context.models;

  try {
    // Update the user's email in the database
    let t = await User.updateOne({ "_id": _id }, { $set: { "email": req.body.email } })

    // Return the response from the database update
    res.json(t)
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Define a route handler to handle a POST request to "/language"
router.post("/language", middleware.isLoggedIn, async (req: any, res) => {

  // Get the user ID from the request object
  const { _id } = req.user;

  // Get the User model from the context object
  const { User } = req.context.models;

  try {
    // Update the user's language in the database
    let t = await User.updateOne({ "_id": _id }, { $set: { "language": req.body.language } })

    // Return the response from the database update
    res.json(t)
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// Define a route handler to handle a Get request to "/"
router.get("/", middleware.isLoggedIn, async (req: any, res) => {

  // Get the user ID from the request object
  const { _id } = req.user;
  // Get the User model from the context object
  
  const { User } = req.context.models;

  try {
    // Find the user in the database
    let t = await User.findOne({ "_id": req.headers.id!="0"?req.headers.id:_id })

    // Return the response from the database update
    res.json(t)
  } catch (error) {
    // If there is an error, return a 400 status code and the error message
    res.status(400).json({ error });
  }
});

// GET route for getting the followers of a user
router.get("/follows", middleware.isLoggedIn, async (req: any, res) => {
  const { _id } = req.user;
  const { Following } = req.context.models;
  try {
    // Finding the Followers document with the specified user ID and owner ID
    let t = await Following.findOne({ "owner": _id, "user": req.headers.user})
    // Sending the Followers document as a response
    if (t == null) {
    return res.json([false, false]);
    }
    return res.json([true, t["requested"] == true ? true : false, false]);
  } catch (error) {
    // Sending an error response if there's an error in finding the document
    res.status(400).json({ error });
  }
});


// GET route for getting the followers of a user
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {
  const { _id } = req.user;
  const { Friends } = req.context.models;
  try {
    // Finding the Followers document with the specified user ID and owner ID
    let t = await Friends.findOne({ "owner": _id, "user": req.headers.user})
    // Sending the Followers document as a response
    if (t == null) {
    let friend = await Friends.findOne({ "owner": req.headers.user, "user": _id})
    if(friend["requested"] == true) { 
      return res.json([false, false, true]);

    }
    return res.json([false]);
    }
    return res.json([true, t["requested"] == true ? true : false, false]);
  } catch (error) {
    // Sending an error response if there's an error in finding the document
    res.status(400).json({ error });
  }
});


export default router;