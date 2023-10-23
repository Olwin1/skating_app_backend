// Import necessary libraries
import * as dotenv from "dotenv"; // dotenv library to load environment variables from .env file
import { PrismaClient } from '@prisma/client'

import log from "../logger"; // logger library to log messages

// Load environment variables from .env file (you should have a .env file with your database configuration)
dotenv.config();

const prisma = new PrismaClient()
log.log.green("DATABASE STATE", "Postgres Connection Open")

export default prisma;