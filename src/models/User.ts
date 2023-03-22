//const {Schema, model} = require("../db/connection") // import Schema & model
import { Schema, model } from "mongoose";
import "../db/connection";

// User interface
interface IUser extends Document {
    username: string;
    password: string;
}

// User schema
const UserSchema = new Schema<IUser>({
    username: {type: String, unique: true, required: true},
    password: {type: String, required: true}
})

// User model
const User = model<IUser>("User", UserSchema)

export default User;
