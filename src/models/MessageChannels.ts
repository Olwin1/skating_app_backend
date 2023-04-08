// Importing required dependencies
import mongoose from "../db/connection";
// Defining the IMessage interface
interface IMessageChannels {
    channels: Array<mongoose.Types.ObjectId>;
}
// Defining the MessageSchema
const MessageChannelsSchema: mongoose.Schema<IMessageChannels> = new mongoose.Schema<IMessageChannels>({
    channels: [{ type: mongoose.Types.ObjectId }] // Array of message conversations
})

// Creating the Message model using the MessageSchema
const MessageChannels = mongoose.model<IMessageChannels>("MessageChannels", MessageChannelsSchema)

// Exporting the Message model
export default MessageChannels;
