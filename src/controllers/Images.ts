require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import mongoose from "../db/connection";
import { files, filesChunks } from "../db/bucket"; // Import upload utility from bucket.ts
import isAnimated from "is-animated";
import sharp from "sharp";
import { Buffer } from "buffer";
import * as fs from "fs";

const router = Router(); // create router to create route bundle

// Route to create a new channel with the specified participants
router.get("/:image", async (req: any, res) => {
  return await getImage(req, res, false);
});
router.get("/thumbnail/:image", async (req: any, res) => {
  return await getImage(req, res, true);
});

const getImage = async (req: any, res: any, thumbnail: boolean) => {
  try {
    // Convert the request parameter to a MongoDB ObjectId
    const id = new mongoose.Types.ObjectId(req.params.image);

    // Find the file with the specified ID in the "files" collection
    const file = await files.findOne({ _id: id });

    // Retrieve the chunks of the file from the "filesChunks" collection
    let chunks = await filesChunks
      .find({ files_id: file!._id })
      .sort({ n: 1 })
      .toArray();

    // If no chunks are found, return an error message
    if (!chunks || chunks.length === 0) {
      return res.render("index", {
        title: "Download Error",
        message: "No data found",
      });
    }

    // Concatenate the binary data of the file chunks and convert it to a base64-encoded string
    let fileData: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      fileData.push(chunks[i].data.toString("base64"));
    }
    let b64 = fileData.join("");
    let img = Buffer.from(b64, "base64");
    //thumbnail = "true";

    // Set the appropriate content type and content length headers based on the file type
    if (file!.contentType == "image/jpeg" && !thumbnail) {
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": img.length,
      });
    } else if (file!.contentType == "image/png" && !thumbnail) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": img.length,
      });
    } else if (file!.contentType == "image/bmp" && !thumbnail) {
      res.writeHead(200, {
        "Content-Type": "image/bmp",
        "Content-Length": img.length,
      });
    } else if (file!.contentType == "image/gif" && !thumbnail) {
      // If the GIF is animated, return an error message
      if (isAnimated(img)) {
        return res.json({
          title: "Download Error",
          message: "Animated GIFs Not Supported",
        });
      }
      res.writeHead(200, {
        "Content-Type": "image/gif",
        "Content-Length": img.length,
      });
    } else if (file!.contentType == "video/mp4" && !thumbnail) {
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": img.length,
      });
    } else if (file!.contentType == "video/mov" && !thumbnail) {
      res.writeHead(200, {
        "Content-Type": "video/mov",
        "Content-Length": img.length,
      });
    } else if (!thumbnail) {
      // If the file type is not supported, return an error message
      return res.json({
        title: "Download Error",
        message: "Unsupported File Type",
      });
    }
    // Return the file data as the response body
    if (thumbnail) {
      // check if a "thumbnail" header was sent with the request
      var ia: Buffer = await sharp(img) // create a new instance of the Sharp image processing library with the provided "img"
        .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0 } }) // resize the image to fit within a 240x240 bounding box, with a black background
        .jpeg({ quality: 80 }) // convert the image to JPEG format with a quality level of 80
        .toBuffer(); // convert the image to a buffer object
      console.log(img.length); // print the length (in bytes) of the original image to the console
      console.log(ia.length); // print the length (in bytes) of the processed image to the console
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": ia.length,
      });
      return res.end(ia); // send the processed image as the response to the request
    } else {
      return res.end(img);
    }
  } catch (err) {
    // If an error occurs while retrieving the file chunks, return an error message
    return res.json({
      title: "Download Error",
      message: "Error retrieving chunks",
      error: err,
    });
  }
};

router.get("/background/:image", async (req: any, res) => {
  fs.readFile("./src/assets/" + req.params.image, async function (err, data) {
    if (err) throw err;
    var ia: Buffer = await sharp(data) // create a new instance of the Sharp image processing library with the provided "img"
      .resize(parseInt(req.headers.width), parseInt(req.headers.height), {
        fit: "cover",
        background: { r: 0, g: 0, b: 0 },
      }) // resize the image to fit within a 240x240 bounding box, with a black background
      .jpeg({ quality: 80 }) // convert the image to JPEG format with a quality level of 80
      .toBuffer();
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": ia.length,
    });
    return res.end(ia); // send the processed image as the response to the request
  });
});

export default router;
