// Load environment variables from .env file
require("dotenv").config();

// Import necessary modules and libraries
import { Router } from "express";
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Unique ID generator library
import { $Enums, Prisma } from "@prisma/client";
import { ErrorCode } from "../ErrorCodes";

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
        await createReport(userId, req.body.subject, req.body.content, $Enums.feedback_type.bug_report);
        return res.status(201).json({ "success": true })
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
        await createReport(userId, req.body.subject, req.body.content, $Enums.feedback_type.support_request);
        return res.status(201).json({ "success": true })
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
        await createReport(userId, req.body.subject, req.body.content, $Enums.feedback_type.feedback);
        return res.status(201).json({ "success": true })
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
        let resp = await getReports(userId, $Enums.feedback_type.bug_report, req.headers.page);
        return res.status(200).json(resp)
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
        let resp = await getReports(userId, $Enums.feedback_type.support_request, req.headers.page);
        return res.status(200).json(resp)
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
        let resp = await getReports(userId, $Enums.feedback_type.feedback, req.headers.page);
        return res.status(200).json(resp)
    } catch (error) {
        // Handle errors during general feedback retrieval
        res.status(400).json({ error });
    }
});

// Function to create a new user feedback or support record
async function createReport(userId: bigint, subject: string, content: string, type: $Enums.feedback_type) {
    return await prisma.user_feedback_and_support.create({
        data: {
            feedback_id: generator.nextId(),
            user_id: userId,
            type: type,
            subject: subject,
            content: content,
            status: $Enums.feedback_status.open,
            created_at: new Date()
        }
    });
}

// Function to retrieve user feedback or support records
async function getReports(userId: bigint, type: $Enums.feedback_type, page: string) {
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

// Define a route to handle the creation of a new support message
router.post("/support/message", middleware.isLoggedIn, async (req: any, res) => {
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
            }
        });

        // Respond with the created support message in JSON format
        res.json(newMessage);
    } catch (error) {
        // Handle errors by sending a 400 status along with an error message in JSON format
        res.status(400).json({ error: "Failed to create a new support message." });
    }
});


// Handle GET requests to "/support/messages" endpoint with user authentication middleware
router.get("/support/messages", middleware.isLoggedIn, async (req: any, res) => {
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
                    orderBy: { timestamp: Prisma.SortOrder.desc }
                }
            }
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



// Export the router for use in other modules
export default router;
