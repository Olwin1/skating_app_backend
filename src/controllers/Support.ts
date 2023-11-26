// Load environment variables from .env file
require("dotenv").config();

// Import necessary modules and libraries
import { Router } from "express";
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Unique ID generator library
import { $Enums } from "@prisma/client";

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
        await getReports(userId, $Enums.feedback_type.bug_report, req.body.page);
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
        await getReports(userId, $Enums.feedback_type.support_request, req.body.page);
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
        await getReports(userId, $Enums.feedback_type.feedback, req.body.page);
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
async function getReports(userId: bigint, type: $Enums.feedback_type, page: number) {
    return await prisma.user_feedback_and_support.findMany({
        where: {
            user_id: userId,
            type: type,
        },
        include: { users_user_feedback_and_support_assigned_toTousers: true },
        skip: page * 20,
        take: 20,
    });
}

// Export the router for use in other modules
export default router;
