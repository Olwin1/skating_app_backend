import mongoose from  "../db/connection";

// Define the shape of a single follower user
interface IFollowingUser {
    follow_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    requested: boolean;
}

// Define the shape of the whole Following document
interface IFollowing {
    users: IFollowingUser[];
}

// Define a schema for a single follower user
const FollowingUserSchema: mongoose.Schema<IFollowingUser> = new mongoose.Schema<IFollowingUser>({
    follow_date: { type: Date, required: true }, // A date field indicating when the user started following
    user: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // A reference to the User document this follower follows
    requested: { type: Boolean },   // If not yet accepted & is private accound
})

// Define a schema for the entire Following document
const FollowingSchema: mongoose.Schema<IFollowing> = new mongoose.Schema<IFollowing>({
    users: [{ type: FollowingUserSchema }] // An array of follower users
})

// Create a Mongoose model based on the Following schema
const Following = mongoose.model<IFollowing>("Following", FollowingSchema)

// Export the Following model for use in other parts of the code
export default Following;
