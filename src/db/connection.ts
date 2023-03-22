import * as dotenv from "dotenv";
dotenv.config(); // load .env variables

import mongoose from "mongoose"; //import fresh mongoose object
import  log from "mercedlogger"; // import merced logger

// DESTRUCTURE ENV VARIABLES
const { DATABASE_URL } = process.env;

// CONNECT TO MONGO
mongoose.connect(DATABASE_URL!, { useNewUrlParser: true, useUnifiedTopology: true } as mongoose.ConnectOptions)
    .then(() => log.log.green("DATABASE STATE", "Connection Open"))
    .catch((error) => log.log.red("DATABASE STATE", error));

// CONNECTION EVENTS
mongoose.connection
    .on("close", () => log.log.magenta("DATABASE STATE", "Connection Closed"))
    .on("error", (error) => log.log.red("DATABASE STATE", error));

// EXPORT CONNECTION
export default mongoose;
