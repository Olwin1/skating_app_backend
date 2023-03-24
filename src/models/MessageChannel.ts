// Importing necessary modules and files
import { Schema, model, ObjectId } from "mongoose";
import "../db/connection"; 

// Defining the interface for the Channel schema
interface IChannel extends Document {
    messages: Array<ObjectId>;
    creation_date: Date;
}

// Defining the Channel schema using the IChannel interface
const ChannelSchema = new Schema<IChannel>({
    messages: [{ type: Schema.Types.ObjectId }], // An array of ObjectIds referencing Message documents
    creation_date: { type: Date, required: true }, // The date when the channel was created
})

// Creating a model for the Channel schema using the ChannelSchema
const Channel = model<IChannel>("Channel", ChannelSchema)

// Exporting the Channel model for use in other parts of the code
export default Channel;
