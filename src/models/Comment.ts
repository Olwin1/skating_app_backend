import { Schema, model, ObjectId } from "mongoose";
import "../db/connection"; // Importing database connection file

// Defining the Comment interface with required properties
interface IComment extends Document {
    post: ObjectId;
    sender: ObjectId;
    content: String;
    likes: number;
    dislikes: number;
    date: Date;
}

// Creating a new Comment schema using the interface created above
const CommentSchema = new Schema<IComment>({
    post: { type: Schema.Types.ObjectId, required: true }, // ObjectId of the post that the comment belongs to
    sender: { type: Schema.Types.ObjectId, required: true }, // ObjectId of the user who created the comment
    content: { type: String, required: true }, // The actual comment text content
    likes: { type: Number }, // Number of likes received by the comment
    dislikes: { type: Number }, // Number of dislikes received by the comment
    date: { type: Date, required: true }, // Date when the comment was posted
})

// Creating a Comment model using the Comment schema
const Comment = model<IComment>("Comment", CommentSchema)

// Exporting the Comment model
export default Comment;
