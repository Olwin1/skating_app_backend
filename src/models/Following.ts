import { Schema, model, ObjectId, Document } from "mongoose";
import "../db/connection";

// Define the shape of a single follower user
interface IFollowingUser extends Document {
    follow_date: Date;
    user: ObjectId;
}

// Define the shape of the whole Following document
interface IFollowing extends Document {
    users: IFollowingUser[];
}

// Define a schema for a single follower user
const FollowingUserSchema = new Schema<IFollowingUser>({
    follow_date: { type: Date, required: true }, // A date field indicating when the user started following
    user: { type: Schema.Types.ObjectId, required: true, unique: true }, // A reference to the User document this follower follows
})

// Define a schema for the entire Following document
const FollowingSchema = new Schema<IFollowing>({
    users: [{ type: FollowingUserSchema }] // An array of follower users
})

// Create a Mongoose model based on the Following schema
const Following = model<IFollowing>("Following", FollowingSchema)

// Export the Following model for use in other parts of the code
export default Following;
