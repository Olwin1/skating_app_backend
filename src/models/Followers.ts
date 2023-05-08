import mongoose from "../db/connection";

// Define the shape of a single follower user
interface IFollowers {
    follow_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    owner: mongoose.Schema.Types.ObjectId;
    requested: Boolean;
}

// Define a schema for a single follower user
const FollowersSchema: mongoose.Schema<IFollowers> = new mongoose.Schema<IFollowers>({
    follow_date: { type: Date, requried: true }, // A date field indicating when the user started following
    user: { type: mongoose.Schema.Types.ObjectId, required: true }, // A reference to the User document this follower follows
    owner: { type: mongoose.Schema.Types.ObjectId, required: true},
    requested: { type: Boolean },  // If not yet accepted & is private accound
})

// Create a Mongoose model based on the Followers schema
const Followers = mongoose.model<IFollowers>("Followers", FollowersSchema)

// Export the Followers model for use in other parts of the code
export default Followers;
