// Importing required modules and packages
import multer from "multer";
import * as GridFSStorage from "multer-gridfs-storage";
import mongoose from "./connection";
import dotenv from "dotenv";
import { CustomRequest } from "express-override";
// Loading environment variables from .env file
dotenv.config();
const { DATABASE_URI } = process.env;

// Creating a new Mongoose connection to the database URL
const conn = mongoose.createConnection(DATABASE_URI!);

// Declaring variables to store references to the 'uploads.files' and 'uploads.chunks' collections
let files: any;
let filesChunks: any;
mongoose.set("debug", true);

// Listening for the 'open' event to ensure the connection is established before accessing collections
conn.once("open", () => {
  files = conn.db.collection("uploads.files");
  filesChunks = conn.db.collection("uploads.chunks");
});

// Configuring GridFS storage engine for Multer
const storage = new GridFSStorage.GridFsStorage({
  url: DATABASE_URI!,
  file: (req: CustomRequest, file) => {
    // Return a promise that resolves with an object containing the filename and bucketName of the uploaded file
    return new Promise((resolve, reject) => {
      const fileInfo = {
        filename: file.originalname,
        bucketName: "uploads",
      };
      resolve(fileInfo);
    });
  },
});

// Creating a Multer instance with the GridFS storage engine
const upload = multer({ storage: storage });

// Exporting the Multer instance and references to the collections
export { upload, files, filesChunks };
