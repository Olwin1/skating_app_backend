import firebase from "firebase-admin"
import { TokenMessage } from "firebase-admin/lib/messaging/messaging-api";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library


// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const getMessaging = firebase.messaging; // Initialize Firebase Messaging

// Create an asynchronous function to send a message
const createMessage = async (_id: bigint, channel: bigint, content: String, img: String) => {
  console.log("Creating message");

  try {
    console.log(1);

    // Update the last_message_count for a message channel in the database
    const userChannel = await prisma.message_channels.update({
      where: {
        channel_id: channel,
      },
      include: {
        participants: {
          where: {
            participant_id: _id,
          },
        },
      },
      data: {
        last_message_count: { increment: 1 },
      }
    });

    // Create a new message in the database
    await prisma.messages.create({
      data: {
        message_id: generator.nextId(),
        sender_id: _id,
        date_sent: new Date().toISOString(),
        content: content as string,
        //img: img,
        message_number: userChannel?.last_message_count,
        channel_id: userChannel?.channel_id,
      },
    });

    // let participant = await User.findOne({ '_id': participantId }).session(session); // find the other participant in the User collection and attach the session to it

    // if (userChannel!.participants.length == 2) { // if the channel has only two participants
    //     if (!participant!.channels) { // if the other participant doesn't have any channels yet
    //         let [channels] = await Channels.create([{ channels: [userChannel!._id] }], { session: session }); // create a new channel for them and attach the session to it
    //         await User.updateOne(
    //             { "_id": participant!._id },
    //             { $set: { "channels": channels._id } } // set the channel's ID as the other participant's channels array
    //         ).session(session);
    //     }
    // }

    // Create an array to store participant IDs (excluding the sender's ID)
    let participants = [] as bigint[];
    for (let i = 0; i < userChannel.participants.length; i++) {
      if (userChannel.participants[i].user_id != _id) {
        participants.push(userChannel.participants[i].user_id!);
      }
    }

    // Retrieve FCM tokens for the participants
    const fcmTokens = await prisma.fcm_tokens.findMany({ where: { user_id: { in: participants } } });
    const user = await prisma.users.findUnique({ where: { user_id: _id } });

    if (userChannel != null) {
      console.log(2);

      // Iterate through FCM tokens and send messages
      for (let i = 0; i < fcmTokens.length; i++) {
        const currentToken = fcmTokens[i].token;

        // Prepare the message to be sent via FCM
        const message = {
          notification: {
            title: user?.username,
            body: content,
          },
          android: {
            notification: {
              //icon: participant["avatar"]?"http://10.0.2.2:4000/image/thumbnail/"+participant["avatar"]:null
            }
          },
          token: currentToken
        } as TokenMessage;

        console.log("SENDING MESSAGE!" + message.toString());

        // Send the FCM message
        getMessaging().send(message)
          .then((response) => {
            console.log('Successfully sent message:', response);
          })
          .catch(async (error: any) => {
            4
            //TODO FIX THIS BIT - DELETE TOKEN IF FAILED TO SEND NOT SURE IF S|TILL NEEDS FIX
            console.log('Error sending message:', error);

            // If the error is due to an unregistered token, delete it from the database
            if (error["code"] == "messaging/registration-token-not-registered" && participants[i]) {
              await prisma.fcm_tokens.delete({ where: { token_id: fcmTokens[i].token_id } });
            }
          });
      }
    }

    // Return a success response
    return { success: true };
  } catch (error) {
    // Handle errors and return a failure response
    console.log("ERROR");
    console.log(error);
    return { success: false, error: error };
  }
};


export default createMessage;