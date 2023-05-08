import mongoose from "../db/connection";

// Define the shape of a single follower user
interface IFriends {
    friend_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    owner: mongoose.Schema.Types.ObjectId;
    last_session_location: String;
    last_session_date: Date;
    requested: boolean;
}

// Define a schema for a single follower user
const FriendsSchema: mongoose.Schema<IFriends> = new mongoose.Schema<IFriends>({
    friend_date: { type: Date, required: true }, // A date field indicating when the user was friended
    user: { type: mongoose.Schema.Types.ObjectId, required: true }, // A reference to the User document of the friend
    owner: { type: mongoose.Schema.Types.ObjectId, required: true},
    last_session_location: { type: String },
    last_session_date: { type: Date },
    requested: { type: Boolean },
})

// Create a Mongoose model based on the Friends schema
const Friends = mongoose.model<IFriends>("Friends", FriendsSchema)

// Export the Friends model for use in other parts of the code
export default Friends;
