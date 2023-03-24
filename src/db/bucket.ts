// Import required modules
import multer from "multer";
import {GridFsStorage }  from "multer-gridfs-storage/lib/gridfs";
import Grid from "gridfs-stream"
import mongoose from "./connection";
import dotenv from "dotenv"

// Mongo URI
dotenv.config()
const { DATABASE_URL } = process.env;

// Create mongo connection
const conn = mongoose.createConnection(DATABASE_URL!);

// Initialize GridFS
let gfs;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);  
  // Set the name of the collection to be used for file uploads
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: DATABASE_URL!,
  file: (req, file) => {
    console.log(453453)
    return new Promise((resolve, reject) => {
      // Set the filename for the uploaded file
      console.log(666)
      const filename = file.originalname;
      // Create a new file info object with the filename and the name of the GridFS bucket to use
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads'
      };
      console.table(fileInfo)
      // Resolve the promise with the file info object
      resolve(fileInfo);
    });
  }
});

// Create a Multer instance using the GridFS storage engine
const upload = multer({ storage })

// Export the Multer instance
export default upload;
