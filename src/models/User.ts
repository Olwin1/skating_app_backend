// Importing required modules and files
// import the database connection file
import mongoose from "../db/connection" // import Schema & model
// import Schema, model, and ObjectId from mongoose

// Defining the User interface
interface IUser {
    username: string;
    password: string;
    email: string;
    follower_count: number;
    following_count: number;
    friends_count: number;
    posts: Array<mongoose.Schema.Types.ObjectId>; // an array of post object ids
    average_session_time: number;
    average_session_speed: number;
    language: number;
    saved_posts: Array<mongoose.Schema.Types.ObjectId>; // an array of saved post object ids
    avatar: mongoose.Schema.Types.ObjectId; // Avatar Image
    description: string;
    friends: mongoose.Schema.Types.ObjectId;
    private: boolean;
    channels: mongoose.Schema.Types.ObjectId;
    fcm_token: Array<string>;
}

// Defining the User schema
const UserSchema = new mongoose.Schema<IUser>({
    username: {type: String, unique: true, required: true}, // unique username required for all users
    password: {type: String, required: true}, // required password for all users
    email: {type: String, unique: true}, // unique email for all users
    follower_count: {type: Number}, // number of followers for the user
    following_count: {type: Number}, // number of users being followed by the user
    friends_count: {type: Number}, // number of friends of the user
    posts: [{type: mongoose.Schema.Types.ObjectId}], // an array of post object ids
    average_session_time: {type: Number}, // the average session time of the user
    average_session_speed: {type: Number}, // the average session speed of the user
    language: {type: Number}, // the preferred language of the user
    saved_posts: [{type: mongoose.Schema.Types.ObjectId}], // an array of saved post object ids
    avatar: {type: mongoose.Schema.Types.ObjectId}, // Avatar Image
    description: {type: String}, // a short bio/description of the user
    friends: { type: mongoose.Schema.Types.ObjectId},// Reference to friends collection
    private: { type: Boolean }, // Do follows need to be requested
    channels: { type: mongoose.Schema.Types.ObjectId },
    fcm_token: [{type: String}]
})
UserSchema.index({username: "text"})
// Defining the User model using the User schema
const User = mongoose.model<IUser>("User", UserSchema)



// Exporting the User model
export default User;
