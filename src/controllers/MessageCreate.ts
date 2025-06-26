import firebase from "firebase-admin";
import { TokenMessage } from "firebase-admin/lib/messaging/messaging-api";
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import UserNotFoundError from "../Exceptions/Client/UserNotFoundError";
import TransactionHandler from "../utils/transactionHandler";
import { $Enums } from '@prisma/client';

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const getMessaging = firebase.messaging; // Initialize Firebase Messaging

// Create an asynchronous function to send a message
const createMessage = async (
  userId: bigint,
  channel: bigint,
  content: string,
  img: string
) => {
  console.log("Creating message");

  try {
    console.log(1);

    const [userChannel, result] = await TransactionHandler.createTransactionFunction(prisma, async (tx) => { 
    // Update the last_message_count for a message channel in the database
      const userChannel = await tx.message_channels.update({
      where: {
        channel_id: channel,
      },
      include: {
        participants: true,
      },
      data: {
        last_message_count: { increment: 1 },
      },
    });

    // Create a new message in the database
    const result = await prisma.messages.create({
      data: {
        message_id: generator.nextId(),
        sender_id: userId,
        date_sent: new Date().toISOString(),
        content: content as string,
        //img: img,
        message_number: userChannel?.last_message_count,
        channel_id: userChannel?.channel_id,
        type: $Enums.message_type.text
      },
    });
    return [userChannel, result];
  });


    // Create an array to store participant IDs (excluding the sender's ID)
    let participants = [] as bigint[];
    for (let i = 0; i < userChannel.participants.length; i++) {
      if (userChannel.participants[i].user_id != userId) {
        participants.push(userChannel.participants[i].user_id!);
      }
    }

    // Retrieve FCM tokens for the participants
    const fcmTokens = await prisma.fcm_tokens.findMany({
      where: { user_id: { in: participants } },
    });
    const user = await prisma.users.findUnique({ where: { user_id: userId } });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(user, UserNotFoundError.selfUserMessage);

    if (userChannel != null) {
      console.log(2);

      // Iterate through FCM tokens and send messages
      for (let i = 0; i < fcmTokens.length; i++) {
        const currentToken = fcmTokens[i].token;

        // Prepare the message to be sent via FCM
        const message = {
          notification: {
            title: user!.username,
            body: content,
          },
          android: {
            notification: {
              imageUrl:
                user != null && user!["avatar_id"] != null
                  ? "http://10.0.2.2:4000/image/thumbnail/" + user!["avatar_id"]
                  : null,
            },
          },
          data: {
            // Additional data to identify the chat
            channelId: userChannel!.channel_id.toString(), // The ID of the chat
            senderId: user!.user_id.toString(),
            click_action: "FLUTTER_NOTIFICATION_CLICK", // Required to handle notification clicks in Flutter
          },
          token: currentToken,
        } as TokenMessage;

        console.log("SENDING MESSAGE!" + message.toString());

        // Send the FCM message
        getMessaging()
          .send(message)
          .then((response) => {
            console.log("Successfully sent message:", response);
          })
          .catch(async (error: any) => {
            4;
            //TODO FIX THIS BIT - DELETE TOKEN IF FAILED TO SEND NOT SURE IF S|TILL NEEDS FIX

            // If the error is due to an unregistered token, delete it from the database
            if (
              error["code"] == "messaging/registration-token-not-registered" &&
              fcmTokens[i]
            ) {
              console.log(
                `Failed for token: ${fcmTokens[i].token_id} - Deregistering.`
              );
              await prisma.fcm_tokens.delete({
                where: { token_id: fcmTokens[i].token_id },
              });
            } else {
              console.log("Error sending notification to client:", error);
            }
          });
      }
      return result;
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
