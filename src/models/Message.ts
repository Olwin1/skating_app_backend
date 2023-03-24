// Import the necessary modules from Mongoose
import { Schema, model, ObjectId } from "mongoose";

// Import the connection to the database
import "../db/connection";

// Define an interface for the Message document
interface IMessage extends Document {
    sender: ObjectId;
    date_sent: Date;
    content: String;
    img: String;
}

// Define the schema for the Message document
const MessageSchema = new Schema<IMessage>({
    sender: { type: Schema.Types.ObjectId, required: true }, 
    date_sent: { type: Date, required: true },
    content: { type: String, required: true },
    img: { type: String, },
})

// Create a model from the schema, and give it a name
const Message = model<IMessage>("Message", MessageSchema)

// Export the Message model
export default Message;
