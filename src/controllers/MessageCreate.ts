import mongoose from "../db/connection";
import User from "../models/User";
import Channel from "../models/MessageChannel";
import Channels from "../models/MessageChannels";
import Message from "../models/Message";

const createMessage = async (_id: String, channel: String, content: String, img: String) => {

const session = await mongoose.startSession(); // start a new MongoDB transaction session
session.startTransaction(); // start a transaction within the session
try {
    let userChannel = await Channel.findOne({ '_id': channel, participants: _id }).session(session); // find the channel the message belongs to and attach the session to it
    await Message.create([{
        sender: _id,
        date_sent: Date(),
        content: content,
        img: img,
        message_number: userChannel!.last_message_count ? userChannel!.last_message_count.valueOf() + 1 : 0,
        channel: userChannel!._id,
    }], { session: session }); // create a new message with the provided data and attach the session to it
    await Channel.updateOne(// TODO chang to find and update
        { "_id": channel },
        { $inc: { "last_message_count": 1 } } // set the channel's ID as the other participant's channels array
    ).session(session);

    if (userChannel!.participants.length == 2) { // if the channel has only two participants
        let participant = await User.findOne({ '_id': userChannel!.participants[0] }).session(session); // find the other participant in the User collection and attach the session to it
        if (!participant!.channels) { // if the other participant doesn't have any channels yet
            let [channels] = await Channels.create([{ channels: [userChannel!._id] }], { session: session }); // create a new channel for them and attach the session to it
            await User.updateOne(
                { "_id": participant!._id },
                { $set: { "channels": channels._id } } // set the channel's ID as the other participant's channels array
            ).session(session);
        }
    }

    await session.commitTransaction(); // commit the transaction to the database
    return { success: true } // send a success response to the client
} catch (error) {
    await session.abortTransaction(); // abort the transaction if an error occurs
    return  {success: false, error: error } // send an error response to the client
} finally {
    session.endSession(); // end the session
}
};

export default createMessage;