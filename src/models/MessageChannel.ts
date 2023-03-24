// Importing necessary modules and files
import mongoose from "../db/connection"; 

// Defining the interface for the Channel schema
interface IChannel {
    messages: Array<mongoose.Schema.Types.ObjectId>;
    creation_date: Date;
}

// Defining the Channel schema using the IChannel interface
const ChannelSchema: mongoose.Schema<IChannel> = new mongoose.Schema<IChannel>({
    messages: [{ type: mongoose.Schema.Types.ObjectId }], // An array of ObjectIds referencing Message documents
    creation_date: { type: Date, required: true }, // The date when the channel was created
})

// Creating a model for the Channel schema using the ChannelSchema
const Channel = mongoose.model<IChannel>("Channel", ChannelSchema)

// Exporting the Channel model for use in other parts of the code
export default Channel;
