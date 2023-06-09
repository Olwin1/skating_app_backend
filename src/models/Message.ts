// Import the connection to the database
import mongoose from "../db/connection";

// Define an interface for the Message document
interface IMessage {
    sender: mongoose.Schema.Types.ObjectId;
    seen_by: Array<mongoose.Types.ObjectId>|Array<boolean>;
    date_sent: Date;
    content: String;
    img: mongoose.Schema.Types.ObjectId;
    message_number: Number;
    channel: mongoose.Schema.Types.ObjectId;
}

// Define the schema for the Message document
const MessageSchema: mongoose.Schema<IMessage> = new mongoose.Schema<IMessage>({
    sender: { type: mongoose.Schema.Types.ObjectId, required: true }, 
    seen_by: [{ user: {type: mongoose.Schema.Types.ObjectId}, seen: Boolean }],
    date_sent: { type: Date, required: true },
    content: { type: String, required: true },
    img: { type: mongoose.Schema.Types.ObjectId, },
    message_number: { type: Number, required: true },
    channel: { type: mongoose.Schema.Types.ObjectId }
})

// Create a model from the schema, and give it a name
const Message = mongoose.model<IMessage>("Message", MessageSchema)

// Export the Message model
export default Message;
