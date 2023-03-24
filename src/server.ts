// Load environment variables from .env file
require("dotenv").config();

// Import required modules
import express from "express";
import morgan from "morgan";
import log from "mercedlogger";
import cors from "cors";
import bodyParser from "body-parser";
import UserRouter from "./controllers/User"; // Import User Router
import TodoRouter from "./controllers/Todo"; // Import Todo Router
import middleware from "./controllers/middleware";
import upload from "./db/bucket"; // Import upload utility from bucket.ts

// Destructure environment variables with default values
const { PORT = 3000 } = process.env;

// Create application object
const app = express();

// Apply global middleware
app.use(cors()); // add CORS headers to allow cross-origin requests
app.use(morgan("tiny")); // log incoming requests to console for debugging
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use(middleware.createContext); // create req.context for each request

// Define routes
app.get("/", (req, res) => {
  res.send("This is the test route to make sure server is working");
});
app.use("/user", UserRouter); // route all "/user" requests to UserRouter for further processing
app.use("/todos", TodoRouter); // route all "/todos" requests to TodoRouter for further processing

// Define route for file uploads using the upload utility
app.post("/upload", upload.single("file"), (req, res) => {
  res.json(req.file) // Send back file information
});

// Start listening for incoming requests
app.listen(PORT, () =>
  log.log.green("SERVER STATUS", `Listening on port ${PORT}`)
);
