import mongoose from "../db/connection";


interface IPost {
    description: string;
    like_count: number;
    like_users: Array<mongoose.Schema.Types.ObjectId>
    comments: Array<mongoose.Schema.Types.ObjectId>;
    author: mongoose.Schema.Types.ObjectId;
    image: mongoose.Schema.Types.ObjectId;
    date: Date;
}

const PostSchema: mongoose.Schema<IPost> = new mongoose.Schema<IPost>({
    description: { type: String },
    like_count: { type: Number },
    like_users: [{ type: mongoose.Schema.Types.ObjectId }],
    comments: [{ type: mongoose.Schema.Types.ObjectId }],
    author: { type: mongoose.Schema.Types.ObjectId },
    image: { type: mongoose.Schema.Types.ObjectId, required: true }, // Required image for all posts || Changeme
    date: { type: Date, required: true }, // Required date that the post was uploaded
})


const Post = mongoose.model<IPost>("Post", PostSchema)


export default Post;
