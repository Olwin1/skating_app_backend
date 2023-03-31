import mongoose from "../db/connection";

// Define the shape of a single follower user
interface IFriendsUser {
    friend_date: Date;
    user: mongoose.Schema.Types.ObjectId;
    last_session_location: String;
    last_session_date: Date;
    requested: boolean;
}

// Define the shape of the whole Friends document
interface IFriends {
    users: IFriendsUser[];
}

// Define a schema for a single follower user
const FriendsUserSchema: mongoose.Schema<IFriendsUser> = new mongoose.Schema<IFriendsUser>({
    friend_date: { type: Date, required: true }, // A date field indicating when the user was friended
    user: { type: mongoose.Schema.Types.ObjectId, required: true }, // A reference to the User document of the friend
    last_session_location: { type: String },
    last_session_date: { type: Date },
    requested: { type: Boolean },
})

// Define a schema for the entire Friends document
const FriendsSchema: mongoose.Schema<IFriends> = new mongoose.Schema<IFriends>({
    users: [{ type: FriendsUserSchema }] // An array of follower users
})

// Create a Mongoose model based on the Friends schema
const Friends = mongoose.model<IFriends>("Friends", FriendsSchema)

// Export the Friends model for use in other parts of the code
export default Friends;
