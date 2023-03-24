import { Schema, model, ObjectId, Document } from "mongoose";
import "../db/connection";

// Define the shape of a single follower user
interface IFollowersUser extends Document {
    follow_date: Date;
    user: ObjectId;
}

// Define the shape of the whole Followers document
interface IFollowers extends Document {
    users: IFollowersUser[];
}

// Define a schema for a single follower user
const FollowersUserSchema = new Schema<IFollowersUser>({
    follow_date: { type: Date, requried: true }, // A date field indicating when the user started following
    user: { type: Schema.Types.ObjectId, required: true, unique: true }, // A reference to the User document this follower follows
})

// Define a schema for the entire Followers document
const FollowersSchema = new Schema<IFollowers>({
    users: [{ type: FollowersUserSchema }] // An array of follower users
})

// Create a Mongoose model based on the Followers schema
const Followers = model<IFollowers>("Followers", FollowersSchema)

// Export the Followers model for use in other parts of the code
export default Followers;
