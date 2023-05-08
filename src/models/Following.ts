import mongoose from  "../db/connection";

// Define the shape of a single follower user
interface IFollowing {
    follow_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    owner: mongoose.Schema.Types.ObjectId;
    requested: boolean;
}

// Define a schema for a single follower user
const FollowingSchema: mongoose.Schema<IFollowing> = new mongoose.Schema<IFollowing>({
    follow_date: { type: Date, required: true }, // A date field indicating when the user started following
    user: { type: mongoose.Schema.Types.ObjectId, required: true}, // A reference to the User document this follower follows
    owner: { type: mongoose.Schema.Types.ObjectId, required: true},
    requested: { type: Boolean },   // If not yet accepted & is private accound
})

// Create a Mongoose model based on the Following schema
const Following = mongoose.model<IFollowing>("Following", FollowingSchema)

// Export the Following model for use in other parts of the code
export default Following;
