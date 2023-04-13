require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";
import { files, filesChunks } from "../db/bucket"; // Import upload utility from bucket.ts
import isAnimated from 'is-animated';


const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;




// Route to create a new channel with the specified participants
router.get("/:image", async (req: any, res) => {

  // Convert the request parameter to a MongoDB ObjectId
  const id = new mongoose.Types.ObjectId(req.params.image);

  // Find the file with the specified ID in the "files" collection
  const file = await files.findOne({ _id: id });

  // Retrieve the chunks of the file from the "filesChunks" collection
  try {
      let chunks = await filesChunks.find({ files_id: file!._id }).sort({ n: 1 }).toArray();

      // If no chunks are found, return an error message
      if (!chunks || chunks.length === 0) {
          return res.render('index', {
              title: 'Download Error',
              message: 'No data found'
          });
      }

      // Concatenate the binary data of the file chunks and convert it to a base64-encoded string
      let fileData: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
          fileData.push(chunks[i].data.toString('base64'));
      }
      var img = Buffer.from(fileData.join(''), 'base64');

      // Set the appropriate content type and content length headers based on the file type
      if (file!.contentType == "image/jpeg") {
          res.writeHead(200, {
              'Content-Type': 'image/jpeg',
              'Content-Length': img.length
          });
      } else if (file!.contentType == "image/png") {
          res.writeHead(200, {
              'Content-Type': 'image/png',
              'Content-Length': img.length
          });
      } else if (file!.contentType == "image/bmp") {
          res.writeHead(200, {
              'Content-Type': 'image/bmp',
              'Content-Length': img.length
          });
      } else if (file!.contentType == "image/gif") {
          // If the GIF is animated, return an error message
          if (isAnimated(img)) {
              return res.json({
                  title: 'Download Error',
                  message: 'Animated GIFs Not Supported'
              })
          }
          res.writeHead(200, {
              'Content-Type': 'image/gif',
              'Content-Length': img.length
          });
      } else if (file!.contentType == "video/mp4") {
          res.writeHead(200, {
              'Content-Type': 'video/mp4',
              'Content-Length': img.length
          });
      } else if (file!.contentType == "video/mov") {
          res.writeHead(200, {
              'Content-Type': 'video/mov',
              'Content-Length': img.length
          });
      } else {
          // If the file type is not supported, return an error message
          return res.json({
              title: 'Download Error',
              message: 'Unsupported File Type'
          })
      }
      // Return the file data as the response body
      return res.end(img);

  } catch (err) {
      // If an error occurs while retrieving the file chunks, return an error message
      return res.json({
          title: 'Download Error',
          message: 'Error retrieving chunks',
          error: err
      });

  }
});



export default router;