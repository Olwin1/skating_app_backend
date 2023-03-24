// Importing required dependencies
import mongoose from "../db/connection";

// Defining the IMessageConversation interface
interface IMessageConversation {
    last_message: mongoose.Schema.Types.ObjectId;
    participants: Array<mongoose.Schema.Types.ObjectId>;
    channel: mongoose.Schema.Types.ObjectId;
}

// Defining the IMessage interface
interface IMessage {
    channels: IMessageConversation[];
}

// Defining the MessageConversationSchema
const MessageConversationSchema: mongoose.Schema<IMessageConversation> = new mongoose.Schema<IMessageConversation>({
    last_message: { type: mongoose.Schema.Types.ObjectId, }, // ObjectId of the last message in the conversation
    participants: [{ type: mongoose.Schema.Types.ObjectId, required: true, }], // Array of ObjectIds of participants in the conversation
    channel: { type: mongoose.Schema.Types.ObjectId }, // ObjectId of the channel the conversation is taking place in
})

// Defining the MessageSchema
const MessageSchema: mongoose.Schema<IMessage> = new mongoose.Schema<IMessage>({
    channels: [{ type: MessageConversationSchema }] // Array of message conversations
})

// Creating the Message model using the MessageSchema
const Message = mongoose.model<IMessage>("Message", MessageSchema)

// Exporting the Message model
export default Message;
