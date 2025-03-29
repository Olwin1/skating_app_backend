// Load environment variables from .env file
require("dotenv").config();

// Import necessary modules and libraries
import { Router } from "express";
import middleware from "./middleware";
import CustomRequest from "./types/CustomRequest";
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Unique ID generator library
import { $Enums, Prisma } from "@prisma/client";
import { ErrorCode } from "../ErrorCodes";
interface ReportType {
  feedback_id: bigint;
  user_id: bigint;
  type: $Enums.feedback_type | null;
  subject: string | null;
  content: string | null;
  status: $Enums.feedback_status | null;
  assigned_to: bigint | null;
  created_at: Date;
  response: string | null;
  responder_user_id: bigint | null;
}

// Create an instance of Express Router
const router = Router();

// Create a unique ID generator instance for feedback IDs
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});

// Define a route for submitting bug reports
router.post("/bug", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    await createSupportReport(
      userId,
      req.body.subject,
      req.body.content,
      $Enums.feedback_type.bug_report
    );
    return res.status(201).json({ success: true });
  } catch (error) {
    // Handle errors during the bug report submission
    res.status(400).json({ error });
  }
});

// Define a route for submitting support requests
router.post("/support", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    await createSupportReport(
      userId,
      req.body.subject,
      req.body.content,
      $Enums.feedback_type.support_request
    );
    return res.status(201).json({ success: true });
  } catch (error) {
    // Handle errors during the support request submission
    res.status(400).json({ error });
  }
});

// Define a route for submitting general feedback
router.post("/feedback", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    await createSupportReport(
      userId,
      req.body.subject,
      req.body.content,
      $Enums.feedback_type.feedback
    );
    return res.status(201).json({ success: true });
  } catch (error) {
    // Handle errors during the general feedback submission
    res.status(400).json({ error });
  }
});

// Define a route for retrieving bug reports
router.get("/bug", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    let resp = await getReports(
      userId,
      $Enums.feedback_type.bug_report,
      req.headers.page
    );
    return res.status(200).json(resp);
  } catch (error) {
    // Handle errors during bug report retrieval
    res.status(400).json({ error });
  }
});

// Define a route for retrieving support requests
router.get("/support", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    let resp = await getReports(
      userId,
      $Enums.feedback_type.support_request,
      req.headers.page
    );
    return res.status(200).json(resp);
  } catch (error) {
    // Handle errors during support request retrieval
    res.status(400).json({ error });
  }
});

// Define a route for retrieving general feedback
router.get("/feedback", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    let resp = await getReports(
      userId,
      $Enums.feedback_type.feedback,
      req.headers.page
    );
    return res.status(200).json(resp);
  } catch (error) {
    // Handle errors during general feedback retrieval
    res.status(400).json({ error });
  }
});

// Function to create a new user feedback or support record
async function createSupportReport(
  userId: bigint,
  subject: string,
  content: string,
  type: $Enums.feedback_type
) {
  return await prisma.user_feedback_and_support.create({
    data: {
      feedback_id: generator.nextId(),
      user_id: userId,
      type: type,
      subject: subject,
      content: content,
      status: $Enums.feedback_status.open,
      created_at: new Date(),
    },
  });
}

// Function to retrieve user feedback or support records
async function getReports(
  userId: bigint,
  type: $Enums.feedback_type,
  page: string
) {
  const user = await prisma.users.findUnique({ where: { user_id: userId } });
  if (user == null) {
    return;
  }
  if (
    user!.user_role == $Enums.user_role.moderator ||
    user!.user_role == $Enums.user_role.administrator
  ) {
    const pageSize = 20;
    const pageNumber = parseInt(page) * pageSize;
    let remaining = pageSize;

    // Step 1: Fetch `myReports`
    const myReports = await prisma.user_feedback_and_support.findMany({
      where: {
        user_id: userId,
        type: type,
      },
      include: { users_user_feedback_and_support_assigned_toTousers: true },
      orderBy: {
        created_at: "asc",
      },
      skip: pageNumber,
      take: remaining,
    });

    // Adjust the remaining items to fetch
    remaining -= myReports.length;

    // Step 2: Fetch `assignedReports` if there are remaining slots
    let assignedReports: ReportType[] = [];
    if (remaining > 0) {
      assignedReports = await prisma.user_feedback_and_support.findMany({
        where: {
          assigned_to: userId,
          type: type,
          OR: [
            { status: $Enums.feedback_status.in_progress },
            { status: $Enums.feedback_status.open },
            { status: $Enums.feedback_status.resolved },
          ],
        },
        orderBy: {
          created_at: "asc",
        },
        skip: pageNumber > myReports.length ? pageNumber - myReports.length : 0,
        take: remaining,
      });

      // Adjust the remaining items to fetch
      remaining -= assignedReports.length;
    }

    // Step 3: Fetch `unclaimedReports` if there are still remaining slots
    let unclaimedReports: ReportType[] = [];
    if (remaining > 0) {
      unclaimedReports = await prisma.user_feedback_and_support.findMany({
        where: {
          assigned_to: null,
          type: type,
          OR: [
            { status: $Enums.feedback_status.in_progress },
            { status: $Enums.feedback_status.open },
            { status: $Enums.feedback_status.resolved },
          ],
        },
        orderBy: {
          created_at: "asc",
        },
        skip:
          pageNumber > myReports.length + assignedReports.length
            ? pageNumber - (myReports.length + assignedReports.length)
            : 0,
        take: remaining,
      });
    }

    // Combine the results
    const results = [...myReports, ...assignedReports, ...unclaimedReports];

    return results;
  } else {
    return await prisma.user_feedback_and_support.findMany({
      where: {
        user_id: userId,
        type: type,
      },
      include: { users_user_feedback_and_support_assigned_toTousers: true },
      skip: parseInt(page) * 20,
      take: 20,
    });
  }
}

// Define a route to handle the creation of a new support message
router.post("/message", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the authenticated request
    const userId = BigInt((req as CustomRequest).user._id);

    // Create a new support message using Prisma
    const newMessage = await prisma.user_support_messages.create({
      data: {
        message_id: generator.nextId(), // Generate a unique message ID
        feedback_id: BigInt(req.body.feedback_id), // Extract the feedback ID from the request
        sender_id: userId, // Set the sender's user ID
        content: req.body.content, // Extract the message content from the request
        timestamp: new Date().toISOString(), // Set the current timestamp
      },
    });

    // Respond with the created support message in JSON format
    res.json(newMessage);
  } catch (error) {
    // Handle errors by sending a 400 status along with an error message in JSON format
    res.status(400).json({ error: "Failed to create a new support message." });
  }
});

// Handle GET requests to "/support/messages" endpoint with user authentication middleware
router.get("/messages", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the authenticated request
    const userId = BigInt((req as CustomRequest).user._id);

    // Find user feedback and support information based on the provided feedback ID from the request header
    const messages = await prisma.user_feedback_and_support.findFirst({
      where: { feedback_id: BigInt(req.headers.feedback_id) },
      include: {
        // Fetch user support messages with pagination and ordering by timestamp
        user_support_messages: {
          take: 20,
          skip: 20 * req.headers.page,
          orderBy: { timestamp: Prisma.SortOrder.desc },
        },
      },
    });

    if (messages) {
      // Respond with the array of user support messages
      return res.status(200).json(messages.user_support_messages);
    } else {
      // Return a 400 status with an error code if no records are found
      return res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  } catch (error) {
    // Handle any errors and respond with a 400 status along with the error details
    res.status(400).json({ error });
  }
});

// Define a route to handle the creation of a new support message
router.post("/message", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the authenticated request
    const userId = BigInt((req as CustomRequest).user._id);

    // Create a new support message using Prisma
    const newMessage = await prisma.user_support_messages.create({
      data: {
        message_id: generator.nextId(), // Generate a unique message ID
        feedback_id: BigInt(req.body.feedback_id), // Extract the feedback ID from the request
        sender_id: userId, // Set the sender's user ID
        content: req.body.content, // Extract the message content from the request
        timestamp: new Date().toISOString(), // Set the current timestamp
      },
    });

    // Respond with the created support message in JSON format
    res.json(newMessage);
  } catch (error) {
    // Handle errors by sending a 400 status along with an error message in JSON format
    res.status(400).json({ error: "Failed to create a new support message." });
  }
});

// Define a route for submitting general feedback
router.post("/report", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);

    let reportedContent;
    switch (req.body.reported_content) {
      case "comment":
        reportedContent = $Enums.reported_content.comment;
        break;
      case "post":
        reportedContent = $Enums.reported_content.post;
        break;
      case "message":
        reportedContent = $Enums.reported_content.message;
        break;
      default:
        throw Error(
          'reported_content can only be of type "comment"|"post"|"message"'
        );
    }

    await prisma.reports.create({
      data: {
        report_id: generator.nextId(),
        reporter_id: userId,
        reported_user_id: req.body.reported_user_id,
        report_type: req.body.report_type,
        description: req.body.description != "" ? req.body.description : null,
        status: $Enums.report_status.pending_review,
        timestamp: new Date().toISOString(),
        reported_content_id: req.body.reported_content_id,
        reported_content: reportedContent,
      },
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    // Handle errors during the general feedback submission
    res.status(400).json({ error });
  }
});

// Handle GET requests to "/support/report" endpoint with user authentication middleware
router.get("/report", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the authenticated request
    const userId = BigInt((req as CustomRequest).user._id);

    // Find user feedback and support information based on the provided feedback ID from the request header
    const report = await prisma.reports.findFirst({
      where: { report_id: BigInt(req.headers.report_id) },
    });

    if (report) {
      const moderatorUser = await prisma.users.findFirst({
        where: { user_id: userId },
      });
      // Check if the user exists
      if (moderatorUser) {
        if (
          moderatorUser.user_role == $Enums.user_role.moderator ||
          moderatorUser.user_role == $Enums.user_role.administrator
        ) {
          // If they're authorised to access report data then return it back to them
          return res.status(200).json(report);
        } else {
          return res.status(403).json({});
        }
      } else {
        // TODO: CHANGE THIS TO DIFFER FROM NO REPORT
        // Return a 400 status with an error code if no records are found
        return res.status(400).json({ ec: ErrorCode.RecordNotFound });
      }
    } else {
      // Return a 400 status with an error code if no records are found
      return res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  } catch (error) {
    // Handle any errors and respond with a 400 status along with the error details
    res.status(400).json({ error });
  }
});

// Handle GET requests to "/support/report_data" endpoint with user authentication middleware
router.get("/report_data", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract the user ID from the authenticated request
    const userId = BigInt((req as CustomRequest).user._id);

    // Find user feedback and support information based on the provided feedback ID from the request header
    const report = await prisma.reports.findFirst({
      where: { report_id: BigInt(req.headers.report_id) },
    });

    if (report) {
      const moderatorUser = await prisma.users.findFirst({
        where: { user_id: userId },
      });
      // Check if the user exists
      if (moderatorUser) {
        //BREA
        if (
          moderatorUser.user_role == $Enums.user_role.moderator ||
          moderatorUser.user_role == $Enums.user_role.administrator
        ) {
          if (report.reported_content_id) {
            // Is authorised to access this information

            // If the type of data reported is messages
            //---------------------------------------
            if (report.reported_content == $Enums.reported_content.message) {
              // Is authorised to see other users messages provided a report on those messages has been made
              const rootMessage = await prisma.messages.findFirst({
                where: { message_id: report.reported_content_id },
              });
              if (rootMessage) {
                // If there is a root message attempt to get recent messages around the reported message
                const surroundingMessages = await prisma.messages.findMany({
                  where: {
                    message_channels: { channel_id: rootMessage.channel_id },
                    AND: [
                      {
                        message_number: {
                          gte: rootMessage.message_number - 10,
                        },
                      },
                      {
                        message_number: {
                          lte: rootMessage.message_number + 10,
                        },
                      },
                    ],
                  },
                });
                return res.status(200).json(surroundingMessages);
              } else {
                // If original message not found
              }
            }
            // --------------------------------------

            // If the type of data is comment
            // ---------------------------------------
            else if (
              report.reported_content == $Enums.reported_content.comment
            ) {
              const comment = await prisma.comments.findFirst({
                where: { comment_id: report.reported_content_id },
                include: { posts: true },
              });
              return res.status(200).json(comment);
            }
            // ---------------------------------------

            // If the type of data is post
            // ---------------------------------------
            else if (report.reported_content == $Enums.reported_content.post) {
              const post = await prisma.posts.findFirst({
                where: { post_id: report.reported_content_id },
              });
              return res.status(200).json(post);
            }
            // ---------------------------------------

            // This should never run.  Should probably change this to an actual descriptive error at some point
            return res.status(500).json({});
          }
        } else {
          return res.status(403).json({});
        }
      } else {
        // TODO: CHANGE THIS TO DIFFER FROM NO REPORT
        // Return a 400 status with an error code if no records are found
        return res.status(400).json({ ec: ErrorCode.RecordNotFound });
      }
    } else {
      // Return a 400 status with an error code if no records are found
      return res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  } catch (error) {
    // Handle any errors and respond with a 400 status along with the error details
    res.status(400).json({ error });
  }
});

//TODO: Add duration for tempbans and handle creation of tempbans/whatever other punishment.
// Modify Report Status
router.post("/report/modify", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);

    const moderatorUser = await prisma.users.findFirst({
      where: { user_id: userId },
    });
    // Check if the user exists
    if (!moderatorUser) {
      throw Error("No user with that id could be located.");
    }
    if (
      !(
        moderatorUser.user_role == $Enums.user_role.moderator ||
        moderatorUser.user_role == $Enums.user_role.administrator
      )
    ) {
      return res.status(403).json({});
    }

    let reportType: $Enums.report_status;
    switch (req.body.report_status) {
      case "closed_no_resolution":
        reportType = $Enums.report_status.closed_no_resolution;
        break;
      case "escalated":
        reportType = $Enums.report_status.escalated;
        break;
      case "further_investigation":
        reportType = $Enums.report_status.further_investigation;
        break;
      case "invalid":
        reportType = $Enums.report_status.invalid;
        break;
      case "pending_review":
        reportType = $Enums.report_status.pending_review;
        break;
      case "permanent_ban":
        reportType = $Enums.report_status.permanent_ban;
        break;
      case "resolved":
        reportType = $Enums.report_status.resolved;
        break;
      case "temporary_ban":
        reportType = $Enums.report_status.temporary_ban;
        break;
      case "valid_no_action":
        reportType = $Enums.report_status.valid_no_action;
        break;
      case "warning_issued":
        reportType = $Enums.report_status.warning_issued;
        break;
      default:
        throw Error("Invalid report_type argument.");
    }

    await prisma.reports.update({
      data: {
        status: reportType,
      },
      where: { report_id: req.body.report_id },
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    // Handle errors during the general feedback submission
    res.status(400).json({ error });
  }
});

// Get list of active reports
router.get("/report/list", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    const moderatorUser = await prisma.users.findFirst({
      where: { user_id: userId },
    });

    if (
      req.headers.page &&
      moderatorUser &&
      req.headers.is_self == "false" &&
      (moderatorUser.user_role == $Enums.user_role.moderator ||
        moderatorUser.user_role == $Enums.user_role.administrator)
    ) {
      const reports = await prisma.reports.findMany({
        orderBy: {
          timestamp: "desc",
        },
        skip: parseInt(req.headers.page) * 20,
        take: 20,
      });
      return res.status(200).json(reports);
    } else {
      const reports = await prisma.reports.findMany({
        where: { reporter_id: userId },
        orderBy: {
          timestamp: "desc",
        },
        skip: parseInt(req.headers.page) * 20,
        take: 20,
      });
      return res.status(200).json(reports);
    }
  } catch (error) {
    // Handle errors during request
    res.status(400).json({ error });
  }
});

// Get list of reports made by a specific user
router.get(
  "/report/list/from",
  middleware.isLoggedIn,
  async (req: any, res) => {
    try {
      // Extract user ID from the request
      const userId = BigInt((req as CustomRequest).user._id);
      const moderatorUser = await prisma.users.findFirst({
        where: { user_id: userId },
      });

      if (
        req.headers.user == "" ||
        req.headers.user == null ||
        req.headers.user == userId ||
        (req.headers.page &&
          moderatorUser &&
          (moderatorUser.user_role == $Enums.user_role.moderator ||
            moderatorUser.user_role == $Enums.user_role.administrator))
      ) {
        const reports = await prisma.reports.findMany({
          where: {
            reporter_id: req.headers.user ?? userId,
          },
          orderBy: {
            timestamp: "asc",
          },
          skip: parseInt(req.headers.page) * 20,
          take: 20,
        });
        return res.status(200).json(reports);
      }
    } catch (error) {
      // Handle errors during request
      res.status(400).json({ error });
    }
  }
);

// Get a list of reports against a specific user
router.get(
  "/report/list/against",
  middleware.isLoggedIn,
  async (req: any, res) => {
    try {
      // Extract user ID from the request
      const userId = BigInt((req as CustomRequest).user._id);
      const moderatorUser = await prisma.users.findFirst({
        where: { user_id: userId },
      });

      if (
        req.headers.user &&
        req.headers.page &&
        moderatorUser &&
        (moderatorUser.user_role == $Enums.user_role.moderator ||
          moderatorUser.user_role == $Enums.user_role.administrator)
      ) {
        const reports = await prisma.reports.findMany({
          where: {
            reported_user_id: req.headers.user,
          },
          orderBy: {
            timestamp: "asc",
          },
          skip: parseInt(req.headers.page) * 20,
          take: 20,
        });
        return res.status(200).json(reports);
      }
    } catch (error) {
      // Handle errors during request
      res.status(400).json({ error });
    }
  }
);

// Get a list of reports against a specific user
router.get("/report/messages", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    const user = await prisma.users.findFirst({ where: { user_id: userId } });
    const report = await prisma.reports.findFirst({
      where: {
        report_id: req.headers.report_id,
      },
      include: {
        user_report_messages: { orderBy: { timestamp: "asc" } },
      },
      skip: parseInt(req.headers.page) * 20,
      take: 20,
    });

    if (
      report &&
      user &&
      (user.user_role == $Enums.user_role.moderator ||
        user.user_role == $Enums.user_role.administrator ||
        user.user_id == report.reporter_id)
    ) {
      return res.status(200).json(report.user_report_messages);
    } else {
      return res.status(401).json({ Error: "Unauthorised" });
    }
  } catch (error) {
    // Handle errors during request
    res.status(400).json({ error });
  }
});

// Get a list of reports against a specific user
router.post("/report/message", middleware.isLoggedIn, async (req: any, res) => {
  try {
    // Extract user ID from the request
    const userId = BigInt((req as CustomRequest).user._id);
    const user = await prisma.users.findFirst({ where: { user_id: userId } });
    const report = await prisma.reports.findFirst({
      where: {
        report_id: req.body.report_id,
      },
    });

    if (
      report &&
      user &&
      (user.user_role == $Enums.user_role.moderator ||
        user.user_role == $Enums.user_role.administrator)
    ) {
      await prisma.user_report_messages.create({
        data: {
          message_id: generator.nextId(),
          report_id: report.report_id,
          sender_id: user.user_id,
          content: req.body.content,
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(200).json({ Success: true });
    } else {
      return res.status(401).json({ Error: "Unauthorised" });
    }
  } catch (error) {
    // Handle errors during request
    res.status(400).json({ error });
  }
});

//       WERE THEY EXHONOURATED? WERE THEY BANNED? WERE THEY TEMPBANNED? WERE THEY WARNED? I.E DO THEY HAVE A HISTORY?

// TODO: Also at some point implement ways to punish - e.g. BANS.

// Export the router for use in other modules
export default router;
