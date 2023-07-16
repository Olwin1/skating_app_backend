// Import necessary libraries
import * as dotenv from "dotenv"; // dotenv library to load environment variables from .env file
import mongoose from "mongoose"; // Mongoose library to interact with MongoDB
import log from "../logger"; // logger library to log messages

// Load environment variables from .env file
dotenv.config();

// Destructure environment variables
const { DATABASE_URL } = process.env;

// Connect to MongoDB using Mongoose
mongoose.connect(DATABASE_URL!, { useNewUrlParser: true, useUnifiedTopology: true } as mongoose.ConnectOptions)
    .then(() => log.log.green("DATABASE STATE", "Connection Open"))
    .catch((error) => log.log.red("DATABASE STATE", error));

// Listen for connection events
mongoose.connection
    .on("close", () => log.log.magenta("DATABASE STATE", "Connection Closed"))
    .on("error", (error) => log.log.red("DATABASE STATE", error));

let bucket;

// Listen for the "connected" event and create a new GridFSBucket instance
mongoose.connection.on("connected", () => {
    var db = mongoose.connections[0].db;
    bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: "newBucket"
    });
    console.log(bucket);
});

// Export the Mongoose connection
export default mongoose;
