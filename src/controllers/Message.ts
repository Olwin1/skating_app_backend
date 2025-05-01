require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import createMessage from "./MessageCreate";

import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import HandleBlocks from "../utils/handleBlocks";
import CheckNulls from "../utils/checkNulls";
import RouteBuilder from "../utils/RouteBuilder";
import InvalidIdError from "../Exceptions/Client/InvalidIdError";
import TransactionHandler from "../utils/transactionHandler";

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
const router = Router(); // create router to create route bundle

interface IMessageData {
  message_id: bigint;
  message_author: bigint;
  message_content: string;
  message_timestamp: Date;
}
// interface IBlockingData {
//   blocked_id: bigint;
//   blocking_user_id: bigint;
//   blocked_user_id: bigint;
//   timestamp: Date;
// }

interface IParticipantData {
  user_id: bigint;
  avatar_id: String | null;
  username: String;
  display_name: String;
  is_blocked: boolean;
}
interface IChannelData {
  channel_id: bigint;
  creation_date: Date;
  participants: IParticipantData[];
  last_message: IMessageData;
}

// This route handles creating a new message channel.
router.post(
  "/channel",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Parse the list of participants from the request and add the user's ID.
    let participants = JSON.parse(req.body.participants).concat([req.userId]);
    // Generate a unique channel ID.
    const channelId = generator.nextId();

    const participantsData = {
      data: participants.map((userId: bigint) => ({
        participant_id: generator.nextId(),
        user_id: userId,
        channel_id: channelId,
      })),
    };

    // Perform a transaction to do the following:
    //  - Create a new channel in the database.
    //  - Create participant rows for the channel in the database.
    
    const transactionResponse = await TransactionHandler.createTransactionArray(prisma, [
      prisma.message_channels.create({
        data: {
          channel_id: channelId,
          creation_date: new Date().toISOString(),
          last_message_count: 0,
        },
      }),
      prisma.participants.createMany(participantsData)
    ]);
    // Return a success response with the created channel and participants.
    return res
      .status(200)
      .json({ channel: transactionResponse[0], participants: transactionResponse[1] });
  })
);

// This route handles creating a new message in a channel.
router.post(
  "/message",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Call the createMessage function to add a new message to the channel.
    let retval = await createMessage(
      req.userId!,
      InvalidIdError.convertToBigInt(req.body.channel),
      req.body.content,
      req.body.img
    );
    // Return a success response.
    res.status(200).json({ success: true });
  })
);

// This route handles fetching a single message by ID.
router.get(
  "/messages",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Retrieve the channel details by its ID.
    const channel = await prisma.message_channels.findUnique({
      where: {
        channel_id: InvalidIdError.convertToBigInt(req.headers.channel),
      },
      include: { participants: true },
    });

    let blockedUserConstraints = channel?.participants.map(
      (participant) => participant.user_id
    );

    // Check if the current user has blocked the target user
    const blockRecord = await prisma.blocked_users.findFirst({
      where: {
        blocking_user_id: req.userId,
        blocked_user_id: { in: blockedUserConstraints },
      },
    });

    // If the user has blocked the target, fetch messages before the block timestamp
    const messageConditions: any = {
      AND: [
        {
          message_number: {
            gte: channel!.last_message_count - page * 20 - 20,
          },
        },
        {
          message_number: {
            lte: channel!.last_message_count - page * 20,
          },
        },
      ],
    };

    // If the current user has blocked the target user, filter by the block timestamp
    if (blockRecord) {
      messageConditions.AND.push({
        date_sent: {
          lt: blockRecord.timestamp, // Exclude messages after the block timestamp
        },
      });
    }

    // Fetch a list of messages within the specified page range, considering the block condition
    const messages = await prisma.messages.findMany({
      where: messageConditions,
      include: { message_readers: true },
      take: 20,
      orderBy: { message_number: "desc" },
    });

    // Return the list of messages as a JSON response.
    res.status(200).json(messages);
  })
);

// This route handles fetching a list of channels for the authenticated user.
router.get(
  "/channels",
  ...RouteBuilder.createRouteHandler(async (req, res) => {

    const skip = 20 * CheckNulls.checkNullPage(req.headers.page);
    // Retrieve a list of channels associated with the user.
    const channels = await prisma.participants.findMany({
      where: {
        user_id: req.userId,
      },
      include: {
        message_channels: {
          include: {
            participants: {
              select: {
                users: {
                  select: {
                    user_id: true,
                    avatar_id: true,
                    username: true,
                    display_name: true,
                    ...HandleBlocks.getIncludeBlockInfo(req.userId!),
                  },
                },
              },
            },
          },
        },
      },
      skip: skip,
      take: 20
    });
    let channelIds: bigint[] = [];
    let channelLastMessageNumber: number[] = [];
    for (const channel of channels) {
      const currentChannel = channel.message_channels;
      channelIds.push(currentChannel.channel_id);
      channelLastMessageNumber.push(currentChannel.last_message_count);
    }
    let lastMessageContent: { [channelId: string]: IMessageData } = {};

    let lastMessages = await prisma.messages.findMany({
      where: {
        channel_id: { in: channelIds },
        message_number: { in: channelLastMessageNumber },
      },
    });
    for (const channel of channels) {
      const lastMessage = lastMessages
        .filter(
          (message: { channel_id: bigint }) =>
            message.channel_id === channel.channel_id
        )
        .at(-1); // Get the most recent message

      if (lastMessage) {
        lastMessageContent[channel.channel_id.toString()] = {
          message_id: lastMessage.message_id,
          message_author: lastMessage.sender_id,
          message_content: lastMessage.content ?? "",
          message_timestamp: lastMessage.date_sent ?? new Date(),
        };
      }
    }

    let retVals = [] as IChannelData[];
    // Loop through each possible channel
    for (let i = 0; i < channels.length; i++) {
      // Go through every participant of a channel and check if they are blocked
      let participants = [] as IParticipantData[];
      for (
        let j = 0;
        j < channels[i].message_channels.participants.length;
        j++
      ) {
        let currentParticipant =
          channels[i].message_channels.participants[j].users;
        participants[j] = {
          user_id: currentParticipant.user_id,
          avatar_id: currentParticipant.avatar_id,
          username: currentParticipant.username,
          display_name: currentParticipant.display_name,
          is_blocked: HandleBlocks.checkIsBlocked(currentParticipant),
        } as IParticipantData;
      }
      // Return the list of channels as a JSON response.
      let retVal: IChannelData = {
        channel_id: channels[i].channel_id,
        creation_date: channels[i].message_channels.creation_date ?? new Date(),
        participants: participants,
        last_message: lastMessageContent[channels[i].channel_id.toString()],
      };
      retVals.push(retVal);
    }
    return res.status(200).json(retVals);
  })
);

// This route handles fetching details of a single channel.
router.get(
  "/channel",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Retrieve details of a channel by its ID.
    const channel = await prisma.message_channels.findUnique({
      where: {
        channel_id: InvalidIdError.convertToBigInt(req.headers.channel),
      },
    });
    // Return the channel details as a JSON response.
    res.status(200).json(channel);
  })
);

// This route handles fetching a list of users for the authenticated user.
// Used for creating message channels.
router.get(
  "/users",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Retrieve a list of user IDs associated with the authenticated user's channels.
    let channelIds = [];
    const userParticipant = await prisma.participants.findMany({
      where: { user_id: req.userId },
    });
    for (let x = 0; x < userParticipant.length; x++) {
      channelIds.push(userParticipant[x].channel_id);
    }

    // Retrieve a list of participants in the user's channels who are not the authenticated user.
    const participants = await prisma.participants.findMany({
      where: {
        AND: [
          { channel_id: { in: channelIds } },
          { user_id: { not: req.userId } },
        ],
      },
    });

    // Extract user IDs from the participants list.
    const participantIds: bigint[] = [];
    participants.map((participant) => {
      participantIds.push(participant.user_id);
    });

    // Create an exclusion list including those who are blocked by the user and those that have been blocked from the user
    const blockedUsers = (
      await prisma.blocked_users.findMany({
        where: { blocking_user_id: req.userId },
        select: { blocked_user_id: true },
      })
    ).map((user) => user.blocked_user_id);
    const exclusionUsers = blockedUsers
      .concat(
        (
          await prisma.blocked_users.findMany({
            where: { blocked_user_id: req.userId },
            select: { blocking_user_id: true },
          })
        ).map((user) => user.blocking_user_id)
      )
      .concat(participantIds);

    // Retrieve user IDs of friends not in the participant list.
    const friendUserIds: bigint[] = [];
    const usersFriends = await prisma.friends.findMany({
      where: {
        AND: [
          { OR: [{ user1_id: req.userId }, { user2_id: req.userId }] },
          {
            AND: [
              { user1_id: { not: { in: exclusionUsers } } },
              { user2_id: { not: { in: exclusionUsers } } },
            ],
          },
        ],
      },
      skip: page * 20,
      take: 20,
    });
    usersFriends.map((friend) => {
      friendUserIds.push(
        friend.user1_id == req.userId ? friend.user2_id : friend.user1_id
      );
    });

    // Retrieve user details of friends not in the participant list.
    let users = await prisma.users.findMany({
      where: { user_id: { in: friendUserIds } },
    });

    // If there are fewer than 20 users, retrieve additional users who are not in the participant list.
    if (users.length < 20) {
      users = [
        ...users,
        ...(await prisma.users.findMany({
          where: {
            NOT: {
              user_id: {
                in: [...exclusionUsers, ...friendUserIds, req.userId!],
              },
            },
            followers_followers_user_idTousers: {
              some: {
                user_id: req.userId,
              },
            },
          },
          skip: page * 20,
          take: 20,
        })),
      ];
    }

    // Prepare and return the list of users as a JSON response.
    let retvals: {
      user_id: bigint;
      username: string;
      avatar_id: string | null;
    }[] = [];
    users.map((user) => {
      retvals.push({
        user_id: user.user_id,
        username: user.username,
        avatar_id: user.avatar_id,
      });
    });
    res.status(200).json(retvals);
  })
);

// This route handles fetching details of a single channel.
router.delete(
  "/channel",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const channelId = InvalidIdError.convertToBigInt(req.headers.channel);
    // Retrieve details of a channel by its ID.
    const participants = await prisma.participants.deleteMany({
      where: { channel_id: channelId },
    });
    const messages = await prisma.messages.deleteMany({
      where: { channel_id: channelId },
    });
    const channel = await prisma.message_channels.delete({
      where: { channel_id: channelId },
    });
    // Return the channel details as a JSON response.
    res.status(200).json(channel);
  })
);

export default router;
