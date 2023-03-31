import mongoose from "../db/connection";

// Define the shape of a single follower user
interface IFollowersUser {
    follow_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    requested: Boolean;
}

// Define the shape of the whole Followers document
interface IFollowers {
    users: IFollowersUser[];
}

// Define a schema for a single follower user
const FollowersUserSchema: mongoose.Schema<IFollowersUser> = new mongoose.Schema<IFollowersUser>({
    follow_date: { type: Date, requried: true }, // A date field indicating when the user started following
    user: { type: mongoose.Schema.Types.ObjectId, required: true }, // A reference to the User document this follower follows
    requested: { type: Boolean },  // If not yet accepted & is private accound
})

// Define a schema for the entire Followers document
const FollowersSchema: mongoose.Schema<IFollowers> = new mongoose.Schema<IFollowers>({
    users: [{ type: FollowersUserSchema }] // An array of follower users
})

// Create a Mongoose model based on the Followers schema
const Followers = mongoose.model<IFollowers>("Followers", FollowersSchema)

// Export the Followers model for use in other parts of the code
export default Followers;
