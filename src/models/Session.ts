import mongoose from "../db/connection";


interface ISession {
    name: string;
    description: string;
    images: Array<mongoose.Schema.Types.ObjectId>;
type: string;
share: string;
start_time: Date;
end_time: Date;
distance: number;
latitude: number;
longitude: number;
author: mongoose.Schema.Types.ObjectId;

}

const SessionSchema: mongoose.Schema<ISession> = new mongoose.Schema<ISession>({
    name: { type: String },
    description: { type: String },
    images: [{ type: mongoose.Schema.Types.ObjectId }],
    type: { type: String },
    share: { type: String },
    start_time: { type: Date },
    end_time: { type: Date },
    distance: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    author: { type: mongoose.Schema.Types.ObjectId }
})


const Post = mongoose.model<ISession>("Session", SessionSchema)


export default Post;
