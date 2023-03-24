// Importing required dependencies
import { Schema, model, ObjectId, Document } from "mongoose";
import "../db/connection";

// Defining the IMessageConversation interface
interface IMessageConversation extends Document {
    last_message: ObjectId;
    participants: Array<ObjectId>;
    channel: ObjectId;
}

// Defining the IMessage interface
interface IMessage extends Document {
    channels: IMessageConversation[];
}

// Defining the MessageConversationSchema
const MessageConversationSchema = new Schema<IMessageConversation>({
    last_message: { type: Schema.Types.ObjectId, }, // ObjectId of the last message in the conversation
    participants: [{ type: Schema.Types.ObjectId, required: true, }], // Array of ObjectIds of participants in the conversation
    channel: { type: Schema.Types.ObjectId }, // ObjectId of the channel the conversation is taking place in
})

// Defining the MessageSchema
const MessageSchema = new Schema<IMessage>({
    channels: [{ type: MessageConversationSchema }] // Array of message conversations
})

// Creating the Message model using the MessageSchema
const Message = model<IMessage>("Message", MessageSchema)

// Exporting the Message model
export default Message;
