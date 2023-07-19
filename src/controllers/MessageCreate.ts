import mongoose from "../db/connection";
import User from "../models/User";
import Channel from "../models/MessageChannel";
import Channels from "../models/MessageChannels";
import Message from "../models/Message";
import firebase from "firebase-admin"
import { TokenMessage } from "firebase-admin/lib/messaging/messaging-api";
const getMessaging = firebase.messaging
const createMessage = async (_id: String, channel: String, content: String, img: String) => {
  console.log("Creating message")

const session = await mongoose.startSession(); // start a new MongoDB transaction session
session.startTransaction(); // start a transaction within the session
try {
  console.log(1)
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
    let participantId;
    for(let i = 0; i < userChannel!.participants.length; i++) {
      if(userChannel!.participants[i].toString() != _id) {
      participantId = userChannel!.participants[i];
      break
    }}
    let participant = await User.findOne({ '_id': participantId }).session(session); // find the other participant in the User collection and attach the session to it

    if (userChannel!.participants.length == 2) { // if the channel has only two participants
        if (!participant!.channels) { // if the other participant doesn't have any channels yet
            let [channels] = await Channels.create([{ channels: [userChannel!._id] }], { session: session }); // create a new channel for them and attach the session to it
            await User.updateOne(
                { "_id": participant!._id },
                { $set: { "channels": channels._id } } // set the channel's ID as the other participant's channels array
            ).session(session);
        }
    }

if(participant != null){
  let currentToken = "";
  console.log(2)
    for(let i = 0; i< participant["fcm_token"].length; i++) {
      currentToken = participant["fcm_token"][i]
const message = {
  notification: {
    title: participant["username"],
    body: content,
  },
  android: {
    notification: {
      //icon: participant["avatar"]?"http://10.0.2.2:4000/image/thumbnail/"+participant["avatar"]:null
    }
  },
  token: participant!["fcm_token"][i]
} as TokenMessage;
// Send a message to the device corresponding to the provided
// registration token.
console.log("SENDING MESSAGE!" + message.toString())
getMessaging().send(message)
  .then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  })
  .catch(async (error: any) => {4
    //TODO FIX THIS BIT - DELETE TOKEN IF FAILED TO SEND
    console.log('Error sending message:', error);
    if(error["code"] == "messaging/registration-token-not-registered" && participant) {
      await User.updateOne(
        { "_id": participant!["_id"] },
        { $pull: { "fcm_token": currentToken } }
      )
    }
  });
}}
    await session.commitTransaction(); // commit the transaction to the database
    return { success: true } // send a success response to the client
} catch (error) {
  console.log("ERRROR")
  console.log(error)
    await session.abortTransaction(); // abort the transaction if an error occurs
    return  {success: false, error: error } // send an error response to the client
} finally {
    session.endSession(); // end the session
}
};

export default createMessage;