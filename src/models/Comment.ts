// Change the import statement to import only Schema
import mongoose from "../db/connection";

// Defining the Comment interface with required properties
interface IComment {
    post: mongoose.Schema.Types.ObjectId;
    sender: mongoose.Schema.Types.ObjectId;
    content: string; // Changed to lowercase 'string'
    like_count: number;
    like_users: Array<mongoose.Schema.Types.ObjectId>;
    dislike_users: Array<mongoose.Schema.Types.ObjectId>;
    dislike_count: number;
    date: Date;
}

// Creating a new Comment schema using the interface created above
const CommentSchema: mongoose.Schema<IComment> = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, required: true }, // ObjectId of the post that the comment belongs to
    sender: { type: mongoose.Schema.Types.ObjectId, required: true }, // ObjectId of the user who created the comment
    content: { type: String, required: true }, // The actual comment text content
    like_count: { type: Number }, // Number of likes received by the comment
    like_users: [{ type: mongoose.Schema.Types.ObjectId}], // List of liked users
    dislike_users: [{ type: mongoose.Schema.Types.ObjectId}], // List of liked users
    dislike_count: { type: Number }, // Number of dislikes received by the comment
    date: { type: Date, required: true }, // Date when the comment was posted
});

// Creating a Comment model using the Comment schema
const Comment = mongoose.model<IComment>("Comment", CommentSchema);

// Exporting the Comment model
export default Comment;
