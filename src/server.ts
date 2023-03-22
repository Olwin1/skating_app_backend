require("dotenv").config() // load .env variables
import express from "express" // import express
import morgan from "morgan" //import morgan
import log from "mercedlogger" // import mercedlogger's log function
import cors from "cors" // import cors
import bodyParser from "body-parser"
import UserRouter from "./controllers/User" //import User Routes
import TodoRouter from "./controllers/Todo" // import Todo Routes
import middleware from "./controllers/middleware";


//DESTRUCTURE ENV VARIABLES WITH DEFAULT VALUES
const {PORT = 3000} = process.env

// Create Application Object
const app = express()

// GLOBAL MIDDLEWARE
app.use(cors()) // add cors headers
app.use(morgan("tiny")) // log the request for debugging
app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );
  
  app.use(bodyParser.json());
  app.use(middleware.createContext) // create req.context
  
//app.use(express.json()) // parse json bodies


// ROUTES AND ROUTES
app.get("/", (req, res) => {
    res.send("this is the test route to make sure server is working")
})
app.use("/user", UserRouter) // send all "/user" requests to UserRouter for routing
app.use("/todos", TodoRouter) // send all "/todos" request to TodoROuter

// APP LISTENER

app.listen(PORT, () => log.log.green("SERVER STATUS", `Listening on port ${PORT}`))