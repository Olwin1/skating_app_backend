// Load environment variables from .env file
require("dotenv").config();

// Import required modules
import express from "express";
import morgan from "morgan";
import log from "./logger";
import cors from "cors";
import bodyParser from "body-parser";
import UserRouter from "./controllers/User"; // Import User Router
import ConnectionsRouter from "./controllers/Connections"; // Import Connections Router
import PostRouter from "./controllers/Post"; // Import Post Router
import MessageRouter from "./controllers/Message"; // Import Post Router
import SessionRouter from "./controllers/Session"; // Import Session Router
import ImageRouter from "./controllers/Images";
import NotificationRouter from "./controllers/notifications";
import SupportRouter from "./controllers/Support";
import LocationRouter from "./controllers/Location";
import middleware from "./controllers/middleware";
import { upload } from "./db/bucket"; // Import upload utility from bucket.ts
import { createServer as createServerHTTP } from 'http';
import { createServer as createServerHTTPS, ServerOptions } from 'https';

import Websocket from './websocket';
import MessagesSocket from "./messages.socket";
import jwt, { Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import initFirebase from "./initFirebase";
import { Request, Response } from "express";
import fs from "fs";


// Destructure environment variables with default values
const { PORT = 3000, sHTTPS = false, SSL_KEY, SSL_CERT } = process.env;
const HTTPS = Boolean(sHTTPS);


// This line is from the Node.js HTTPS documentation.
const options: ServerOptions | null = HTTPS ? {
  key: fs.readFileSync(SSL_KEY!),
  cert: fs.readFileSync(SSL_CERT!)
} : null;

// Create application object
const app = express();

// Create server object using the application object

const server = HTTPS ? createServerHTTPS(options!, app) : createServerHTTP(app);

// Create a WebSocket instance using the server object
const io = Websocket.getInstance(server);
initFirebase()

// When a new WebSocket connection is established, run the following function
io.on('connection', (socket) => {

  try {
    // Check if authorization token exists in query params
    if (socket.handshake.headers.token) {
      // Retrieve the token from the query params and cast it as a string
      const token = socket.handshake.headers.token as string;
      // Verify the token using the secret and retrieve the payload
      if (token) {
        const payload = jwt.verify(token, process.env.SECRET as Secret);
        // If the payload is valid, run the MessagesSocket function
        if (payload) {
          MessagesSocket(socket, payload);
        } else {
          // If the payload is not valid, throw an error
          throw Error("Token verification failed");
        }
      } else {
        // If the token is not found, throw an error
        throw Error("Malformed authorization header");
      }
    } else {
      // If no authorization header is found, throw an error
      throw Error("No authorization header");
    }
  } catch (error: any) {
    // If an error is thrown, log the error message and disconnect the socket
    console.log(error.message);
    socket.disconnect();
  }
});

// Apply global middleware
app.use(cors()); // add CORS headers to allow cross-origin requests
app.use(morgan("combined")); // log incoming requests to console for debugging
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use(middleware.createContext); // create (req as CustomRequest).context for each request
// Define routes
app.get("/", (req: Request, res: Response) => {
  res.send("This is the test route to make sure server is working");
});
app.use("/user", UserRouter); // route all "/user" requests to UserRouter for further processing
app.use("/connections", ConnectionsRouter); // route all "/connections" requests to ConnectionsRouter for further processing
app.use("/post", PostRouter); // route all "/post" requests to ConnectionsRouter for further processing
app.use("/message", MessageRouter); // route all "/message" requests to MessageRouter for further processing
app.use("/image", ImageRouter); // route all "/image" requests to MessageRouter for further processing
app.use("/session", SessionRouter); // route all "/session" requests to SessionRouter for further processing
app.use('/notifications', NotificationRouter);
app.use('/support', SupportRouter);
app.use('/location', LocationRouter);


// Define route for file uploads using the upload utility
app.post("/upload", middleware.isLoggedIn, upload.single("file"), (req: Request, res: Response) => {
  const fileInfo = req.file as any
  const id = fileInfo["id"] as mongoose.Schema.Types.ObjectId
  res.json(id.toString())
  console.log(id.toString())
}
);

app.post("/ping", middleware.isLoggedIn, (req: Request, res: Response) => {
  const clientTime = req.body.timestamp;
  const serverTime = new Date();
  console.log("Client Heardbeat");
});

// Start listening for incoming requests
//app.listen(PORT, () =>
//  log.log.green("SERVER STATUS", `Listening on port ${PORT}`)
//);

server.listen(PORT, () =>
  log.log.green("SERVER STATUS", `Listening on port ${PORT} for websockets`)
);