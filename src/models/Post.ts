import { Schema, model, ObjectId } from "mongoose";
import "../db/connection";


interface IPost extends Document {
    description: string;
    like_count: number;
    comments: Array<ObjectId>;
    author: ObjectId;
    image: string;// ADD POST DATE
    date: Date;
}

const PostSchema = new Schema<IPost>({
    description: { type: String },
    like_count: { type: Number },
    comments: [{ type: Schema.Types.ObjectId }],
    author: { type: Schema.Types.ObjectId },
    image: { type: String, required: true }, // Required image for all posts || Changeme
    date: { type: Date, required: true }, // Required date that the post was uploaded
})


const Post = model<IPost>("Post", PostSchema)


export default Post;
