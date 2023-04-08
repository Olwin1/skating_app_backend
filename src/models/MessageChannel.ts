// Importing necessary modules and files
import mongoose from "../db/connection"; 

// Defining the interface for the Channel schema
interface IMessageChannel {
    last_message: mongoose.Schema.Types.ObjectId;
    participants: Array<mongoose.Schema.Types.ObjectId>;
    last_message_count: Number;
    creation_date: Date;
}

// Defining the Channel schema using the IChannel interface
const MessageChannelSchema: mongoose.Schema<IMessageChannel> = new mongoose.Schema<IMessageChannel>({
    last_message: { type: mongoose.Schema.Types.ObjectId, }, // ObjectId of the last message in the conversation
    last_message_count: { type: Number},
    participants: [{ type: mongoose.Schema.Types.ObjectId, required: true, }], // Array of ObjectIds of participants in the conversation
    creation_date: { type: Date, required: true }, // The date when the channel was created
})

// Creating a model for the Channel schema using the ChannelSchema
const MessageChannel = mongoose.model<IMessageChannel>("Channel", MessageChannelSchema)

// Exporting the Channel model for use in other parts of the code
export default MessageChannel;
