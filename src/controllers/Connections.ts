require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;


// Define a route handler to handle a POST request to "/follow"
router.post("/follow", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const { _id } = req.user;

    // Get the User model and the Following and Followers sub-models from the context object
    const { User, Following, Followers } = req.context.models;

    const session = await mongoose.startSession(); // start a MongoDB transaction
    session.startTransaction(); // start a transaction with the session

    try {
        // Update the user's following list in the database
        //let user = await User.findOne({ "_id": _id }).session(session); // pass the session to the find query
        let target = await User.findOne({ "_id": req.body.user }).session(session); // pass the session to the find query

        let userFollowing;
        //if (user.following) {
        // if the user already has a following list, update it by adding the new user they want to follow
        userFollowing = await Following.create([{ owner: _id, follow_date: Date(), user: target._id, requested: target.private ? true : null }], { session }); // pass the session to the update query
        if (!target.private) {
            await User.updateOne(
                { "_id": _id },
                {
                    $inc: { "following_count": 1 }
                }
            ).session(session);
        }
        // } else {
        //     // if the user doesn't have a following list yet, create a new one with the new user they want to follow
        //     [userFollowing] = await Following.create([{users: [{ follow_date: Date(), user: target._id, requested: target.private ? true : null }]}], { session: session }); // pass the session to the create query
        //     if (target.private) {
        //         await User.updateOne({ "_id": _id }, { $set: { "following": userFollowing._id } }).session(session); // pass the session to the update query
        //     }
        //     else {
        //         console.log("2334")
        //         await User.updateOne(
        //             { "_id": _id },
        //             {
        //                 $set: { "following": userFollowing._id },
        //                 $inc: { "following_count": 1 }
        //             }
        //         ).session(session);

        //     }
        // }

        //if (target.followers) {
        // if the user being followed already has a followers list, update it by adding the follower's user ID
        await Followers.create([{ owner: target._id, follow_date: Date(), user: _id, requested: target.private ? true : null }], { session }); // pass the session to the update query
        if (!target.private) {
            await User.updateOne(
                { "_id": target._id },
                {
                    $inc: { "follower_count": 1 }
                }
            ).session(session);

        }
        // } else {
        //     // if the user being followed doesn't have a followers list yet, create a new one with the follower's user ID
        //     let [targetFollowers] = await Followers.create([{users: [{ follow_date: Date(), user: _id, requested: target.private ? true : null }]}], { session: session }); // pass the session to the create query
        //     if (target.private) {
        //         await User.updateOne({ "_id": target._id }, { "followers": targetFollowers._id }).session(session); // pass the session to the update query
        //     }
        //     else {
        //         await User.updateOne(
        //             { "_id": target._id },
        //             {
        //                 $set: { "followers": targetFollowers._id },
        //                 $inc: { "follower_count": 1 }
        //             }
        //         ).session(session);

        //     }
        // }

        await session.commitTransaction(); // commit the transaction
        session.endSession(); // end the session

        // Return the response from the database update
        res.json(userFollowing);
    } catch (error) {
        await session.abortTransaction(); // abort the transaction if an error occurred
        session.endSession(); // end the session
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});



// Define a route handler to handle a POST request to "/friend"
router.post("/friend", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const { _id } = req.user;

    // Get the User model and the Friends sub-models from the context object
    const { User, Friends } = req.context.models;

    const session = await mongoose.startSession(); // start a MongoDB transaction
    session.startTransaction(); // start a transaction with the session

    try {
        // Update the user's following list in the database
        //let user = await User.findOne({ "_id": _id }).session(session); // pass the session to the find query
        let target = await User.findOne({ "_id": req.body.user }).session(session); // pass the session to the find query
        let friendDate = Date()

        let userFriends;
        //if (user.friends) {
        // if the user already has a friends list, update it by adding the new user they want to friend
        userFriends = await Friends.create([{ owner: _id, friend_date: friendDate, user: target._id, requested: true, requester: true }], { session }); // pass the session to the update query
        // } else {
        //     // if the user doesn't have a friends list yet, create a new one with the new user they want to friend
        //     [userFriends] = await Friends.create([{users: [{ friend_date: Date(), user: target._id, requested: true }]}], { session: session }); // pass the session to the create query
        //     await User.updateOne({ "_id": _id }, { "friends": userFriends._id }).session(session); // pass the session to the update query
        // }

        //if (target.friends) {
        // if the user being friended already has a friends list, update it by adding the friend's user ID
        await Friends.create([{ owner: target._id, friend_date: friendDate, user: _id, requested: true, requester: false }], { session }) // pass the session to the update query
        // } else {
        //     // if the user being friended doesn't have a friends list yet, create a new one with the friend's user ID
        //     let [targetFriends] = await Friends.create([{users: [{ friend_date: friendDate, user: _id, requested: true }]}], { session: session }); // pass the session to the create query
        //     await User.updateOne({ "_id": target._id }, { "friends": targetFriends._id }).session(session); // pass the session to the update query
        // }

        await session.commitTransaction(); // commit the transaction
        session.endSession(); // end the session

        // Return the response from the database update
        res.json(userFriends);
    } catch (error) {
        await session.abortTransaction(); // abort the transaction if an error occurred
        session.endSession(); // end the session
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});


// Route for unfollowing a user
router.post("/unfollow", middleware.isLoggedIn, async (req, res) => {
    const { _id } = req.user;
    const { User, Following, Followers } = req.context.models;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Find the logged in user
        //let user = await User.findOne({ "_id": _id }).session(session);

        // Find the user being unfollowed
        let target = await User.findOne({ "_id": req.body.user }).session(session);

        let userFollowing;

        // Remove the target user from the logged in user's following list
        userFollowing = await Following.deleteOne({ owner: _id, user: target._id }
        ).session(session);

        // Remove the logged in user from the target user's followers list
        let follow = await Followers.findOneAndDelete({ owner: target._id, user: _id }).session(session);
        if (!follow["requested"]) {
            await User.updateOne({ "_id": _id }, { $inc: { "following_count": -1 } }).session(session);
            await User.updateOne({ "_id": target._id }, { $inc: { "follower_count": -1 } }).session(session);

        }

        await session.commitTransaction();
        session.endSession();
        res.json(userFollowing);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});

// Route for unfollowing a user
router.post("/unfollower", middleware.isLoggedIn, async (req, res) => {
    const { _id } = req.user;
    const { User, Following, Followers } = req.context.models;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the logged in user
        //let user = await User.findOne({ "_id": _id }).session(session);
        // Find the user being unfollowed
        let target = await User.findOne({ "_id": req.body.user }).session(session);
        let userFollowers;

        // Remove the target user from the logged in user's followers list
        userFollowers = await Followers.deleteOne({ owner: _id, user: target._id }
        ).session(session);

        // Remove the logged in user from the target user's following list
        let following = await Following.findOneAndDelete({ owner: target._id, user: _id }
        ).session(session);
        if (!following["requested"]) {
            await User.updateOne({ "_id": _id }, { $inc: { "follower_count": -1 } }).session(session);
            await User.updateOne({ "_id": target._id }, { $inc: { "following_count": -1 } }).session(session);

        }


        await session.commitTransaction();
        session.endSession();
        res.json(userFollowers);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});



router.post("/unfriend", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = req.user;
    const { User, Friends } = req.context.models;

    // Start a new session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the logged in user and the user to unfriend
        //let user = await User.findOne({ "_id": _id }).session(session);
        let target = await User.findOne({ "_id": req.body.user }).session(session);
        //TODO CHANGE TO FINDANDUPDATE TO REDUCE REQUESTS

        let userFriends;
        // Update the logged in user's friends list to remove the user to unfriend
        userFriends = await Friends.deleteOne({ owner: _id, user: target._id }).session(session);

        // Update the user to unfriend's friends list to remove the logged in user
        let friend = await Friends.findOneAndDelete({ owner: target._id, user: _id }).session(session);
        if (!friend["requested"]) {
            await User.updateOne({ "_id": _id }, { $inc: { "friends_count": -1 } }).session(session);
            await User.updateOne({ "_id": target._id }, { $inc: { "friends_count": -1 } }).session(session);

        }


        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        // Return the updated userFriends object
        res.json(userFriends);
    } catch (error) {
        // If there was an error, abort the transaction and end the session, then send an error response
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/followers"
router.get("/followers", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const { _id } = req.user;

    // Get the Followers model from the context object
    const { Followers } = req.context.models;

    try {
        //let user = await User.findOne({"_id": _id})
        // Find the user in the database
        let t = await Followers.find({ "owner": req.headers.user??_id }).sort({ "requested": -1 }).skip(req.headers.page * 20).limit(20)

        // Return the response from the database update
        res.json(t)
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/following"
router.get("/following", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const { _id } = req.user;

    // Get the Following model from the context object
    const { Following } = req.context.models;

    try {
        //let user = await User.findOne({"_id": _id})
        // Find the user in the database
        let t = await Following.find({ "owner": req.headers.user??_id }).sort({ "requested": -1 }).skip(parseInt(req.headers.page) * 20).limit(20)

        // Return the response from the database update
        res.json(t)
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});

// Define a route handler to handle a Get request to "/friends"
router.get("/friends", middleware.isLoggedIn, async (req: any, res) => {

    // Get the user ID from the request object
    const { _id } = req.user;

    // Get the Friends model from the context object
    const { Friends } = req.context.models;

    try {
        //let user = await User.findOne({"_id": _id})
        // Find the user in the database
        let t = await Friends.find({ owner: req.headers.user??_id }).sort({ "requested": -1 }).skip(req.headers.page * 20).limit(20)

        // Return the response from the database update
        res.json(t)
    } catch (error) {
        // If there is an error, return a 400 status code and the error message
        res.status(400).json({ error });
    }
});


router.patch("/follow", middleware.isLoggedIn, async (req: any, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Get the user ID from the request object
        const { _id } = req.user;

        // Get the Followers and Following models from the context object
        const { User, Followers, Following } = req.context.models;

        // Find the user to follow in the Following collection
        let user = await User.findOne({ "_id": _id }).session(session);
        let targetUser = await User.findOne({ "_id": req.body.user }).session(session);
        let target = await Following.findOne({ "_id": targetUser.following }).session(session);
        let accepted;
        if (req.body.accepted) {
            // Find the current user in the Followers collection and update the requested flag
            await Followers.updateOne(
                // Match the current user's document by their _id
                { "owner": _id, "user": target._id },
                // Use the $set operator to update the value of the "users" property
                {
                    $set: {
                        // Use the $[elem] array filter to match the object in the "users" array where the "user" property matches the target user's _id
                        "requested": false
                    }
                },
                // Use the arrayFilters option to pass the value of target._id to the array filter
                //{ arrayFilters: [{ "elem.user": target._id }] },
            ).session(session);

            await Following.updateOne(
                // Match the target user's document by their _id
                { "owner": target._id, "user": target._id },
                // Use the $set operator to update the value of the "users" property
                {
                    $set: {
                        // Use the $[elem] array filter to match the object in the "users" array where the "user" property matches the user's _id
                        "requested": false
                    }
                },
                // Use the arrayFilters option to pass the value of _id to the array filter
                //{ arrayFilters: [{ "elem.user": _id }] },
            ).session(session);
            await User.updateOne({ "_id": _id }, { $inc: { "follower_count": 1 } }).session(session);
            await User.updateOne({ "_id": targetUser._id }, { $inc: { "following_count": 1 } }).session(session);
            accepted = true

        }
        else {

            // Find the current user in the Followers collection and update the requested flag
            await Followers.deleteOne({ owner: _id, user: target._id },
            ).session(session);

            await Following.updateOne({ owner: target._id, user: _id },
            ).session(session);
            accepted = false

        }
        // TODO: ADD RETURN STUFF

        // If the update is successful, commit the transaction and send a success response with the updated user document
        await session.commitTransaction();
        res.status(200).json({ accepted });

    } catch (error) {
        // If there is an error, abort the transaction and return a 400 status code and the error message
        await session.abortTransaction();
        res.status(400).json({ error });
    } finally {
        // End the session after the transaction
        session.endSession();
    }
});


router.patch("/friend", middleware.isLoggedIn, async (req: any, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Get the user ID from the request object
        const { _id } = req.user;

        // Get the Friend model from the context object
        const { User, Friends } = req.context.models;

        // Find the user to friend in the Friends collection
        //let user = await User.findOne({ "_id": _id }).session(session);
        let targetUser = await User.findOne({ "_id": req.body.user }).session(session);
        //let target = await Friends.findOne({ "_id": targetUser.friends }).session(session);
        let accepted;
        if (req.body.accepted) {
            // Find the current user in the Friends collection and update the requested flag
            await Friends.updateOne({ owner: _id, user: targetUser._id },
                // Use the $set operator to update the value of the "users" property
                {
                    $set: {
                        // Use the $[elem] array filter to match the object in the "users" array where the "user" property matches the target user's _id
                        "requested": false
                    }
                },
                // Use the arrayFilters option to pass the value of target._id to the array filter
                //{ arrayFilters: [{ "elem.user": target._id }] },
            ).session(session);

            await Friends.updateOne(
                // Match the target user's document by their _id
                { owner: targetUser._id, user: _id },
                // Use the $set operator to update the value of the "users" property
                {
                    $set: {
                        // Use the $[elem] array filter to match the object in the "users" array where the "user" property matches the user's _id
                        "requested": false
                    }
                },
                // Use the arrayFilters option to pass the value of _id to the array filter
                //{ arrayFilters: [{ "elem.user": _id }] },
            ).session(session);
            await User.updateOne({ "_id": _id }, { $inc: { "friends_count": 1 } }).session(session);
            await User.updateOne({ "_id": targetUser._id }, { $inc: { "friends_count": 1 } }).session(session);
            accepted = true

        }
        else {

            // Find the current user in the Friends collection and update the requested flag
            await Friends.deleteOne(
                // Match the current user's document by their _id
                { "owner": _id, "user": targetUser._id },
                // Use the $pull operator to remove the value of the "users" property
                //{ $pull: { "users": { user: target._id } } },
            ).session(session);

            await Friends.deleteOne(
                // Match the target user's document by their _id
                { "owner": targetUser._id, "user": _id },
                // Use the $pull operator to remove the value of the "users" property
                //{ $pull: { "users": { user: _id } } },
            ).session(session);
            accepted = false

        }
        // TODO: ADD RETURN STUFF

        // If the update is successful, commit the transaction and send a success response with the updated user document
        await session.commitTransaction();
        res.status(200).json({ accepted });

    } catch (error) {
        // If there is an error, abort the transaction and return a 400 status code and the error message
        await session.abortTransaction();
        res.status(400).json({ error });
    } finally {
        // End the session after the transaction
        session.endSession();
    }
});



export default router;