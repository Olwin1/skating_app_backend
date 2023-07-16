require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;
interface IreturnPost {
    _id: string,
    description: string,
    author: string,
    image: string, 
    date: string, 
    like_count: number, 
    comment_count: number,
    liked: boolean

}


// Define a route to create a new post, with middleware to check if the user is logged in
router.post("/post", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user ID from the authenticated user object
    const { _id } = (req as CustomRequest).user;
    // Get the User and Post models from the request context
    const { User, Post } = (req as CustomRequest).context.models;
    // Start a new MongoDB session
    const session = await mongoose.startSession();
    // Start a transaction within the session
    session.startTransaction();
    try {
        // Create a new post, including the author ID, description, image, and date
        let [post] = await Post.create(
            [{ description: req.body.description, author: _id, image: req.body.image, date: Date() }],
            { session: session }
        );
        // Add the new post's ID to the user's "posts" array
        await User.updateOne(
            { "_id": _id },
            { $push: { "posts": post._id } }
        ).session(session);
        // If everything is successful, commit the transaction
        await session.commitTransaction();
        // End the session
        session.endSession();
        // Return the new post as a JSON response
        res.json(post);
    } catch (error) {
        // If there is an error, abort the transaction
        await session.abortTransaction();
        // End the session
        session.endSession();
        // Return an error response
        res.status(400).json({ error });
    }
});


// Define a route to return a post from a given id, with middleware to check if the user is logged in
router.get("/post", middleware.isLoggedIn, async (req: any, res) => {
    // TODO: ADD PRIVATE POST OPTION & FOLLOWERS / FRIENDS ONLY
    // Get the user ID from the authenticated user object
    // Get the Post model from the request context
    const { Post } = (req as CustomRequest).context.models;
    try {
        // Get post
        let post = await Post.findOne({ "_id": req.headers.post })
        // Return the post as a JSON response
        res.json(post);
    } catch (error) {
        // Return an error response
        res.status(400).json({ error });
    }
});



// Define a route to the '/like' endpoint.
router.post("/like", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object.
    const { _id } = (req as CustomRequest).user;

    // Get the Post model from the request context.
    const { Post } = (req as CustomRequest).context.models;

    // Start a new MongoDB session for this request.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        let post = await Post.findOne({ "_id": req.body.post }).session(session);
        if (!post.like_users.includes(_id)) {

            // If the post has fewer than 1000 likes, add the user's ID to the list of like_users and increment the like_count.
            if (post.like_count) {
                post = await Post.updateOne({ "_id": post._id }, { $inc: { "like_count": 1 }, $push: { "like_users": _id } }).session(session);
            }
            else {
                post = await Post.updateOne({ "_id": post._id }, { $set: { "like_count": 1 }, $push: { "like_users": _id } }).session(session);
            }
        }
        //}
        // If the post already has 1000 likes, just increment the like_count.
        //else {
        //    await Post.updateOne({ "_id": post._id }, { $inc: { "like_count": 1 } }).session(session);
        //}

        // If everything succeeded, commit the transaction and end the session.
        await session.commitTransaction();
        session.endSession();

        // Send the updated post back to the client.
        res.json(post);
    } catch (error) {
        // If anything went wrong, abort the transaction and end the session, then send an error response to the client.
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});

// Define a route to the '/unlike' endpoint.
router.post("/unlike", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object.
    const { _id } = (req as CustomRequest).user;

    // Get the Post model from the request context.
    const { Post } = (req as CustomRequest).context.models;

    // Start a new MongoDB session for this request.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        let post = await Post.findOne({ "_id": req.body.post }).session(session);

        // If the post has user in list of liked users remove them and decrement like count
        if (post.like_users.includes(_id)) {
            post = await Post.updateOne({ "_id": post._id }, { $inc: { "like_count": -1 }, $pull: { "like_users": _id } }).session(session);
        }
        // If the user is not in list of liked users then just decrement the like count.  
        else {
            throw (Error)
            //await Post.updateOne({ "_id": post._id }, { $inc: { "like_count": -1 } }).session(session);
        }

        // If everything succeeded, commit the transaction and end the session.
        await session.commitTransaction();
        session.endSession();

        // Send the updated post back to the client.
        res.json(post);
    } catch (error) {
        // If anything went wrong, abort the transaction and end the session, then send an error response to the client.
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error });
    }
});


// Route for saving a post to a user's saved_posts array
router.post("/save", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user; // Extract user ID from request object
    const { User } = (req as CustomRequest).context.models; // Get User model from request context
    const session = await mongoose.startSession(); // Start a Mongoose session
    session.startTransaction(); // Start a transaction within the session
    try {
        // Update the User document with the new saved post
        let t = await User.updateOne({ "_id": _id }, { $push: { "saved_posts": req.body.post } }).session(session);
        await session.commitTransaction(); // Commit the transaction
        session.endSession(); // End the session
        res.json(t); // Send a JSON response with the update result
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction if there is an error
        session.endSession(); // End the session
        res.status(400).json({ error }); // Send a 400 response with the error message
    }
});

// Route for removing a post from a user's saved_posts array
router.post("/unsave", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user; // Extract user ID from request object
    const { User } = (req as CustomRequest).context.models; // Get User model from request context
    const session = await mongoose.startSession(); // Start a Mongoose session
    session.startTransaction(); // Start a transaction within the session
    try {
        // Update the User document by removing the specified saved post
        let t = await User.updateOne({ "_id": _id }, { $pull: { "saved_posts": req.body.post } }).session(session);
        await session.commitTransaction(); // Commit the transaction
        session.endSession(); // End the session
        res.json(t); // Send a JSON response with the update result
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction if there is an error
        session.endSession(); // End the session
        res.status(400).json({ error }); // Send a 400 response with the error message
    }
});

// Route for adding a comment to a post
router.post("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user; // Extract user ID from request object
    const { Comment, Post } = (req as CustomRequest).context.models; // Get Comment and Post models from request context
    const session = await mongoose.startSession(); // Start a Mongoose session
    session.startTransaction(); // Start a transaction within the session
    try {
        // Create a new comment and associate it with a post and a sender (user)
        let [comment] = await Comment.create([{ "post": req.body.post, "sender": _id, "content": req.body.content, "date": Date() }], { session: session })
        // Add the comment's ID to the post's "comments" array
        await Post.updateOne({ "_id": req.body.post }, { $push: { "comments": comment._id } }).session(session)
        await session.commitTransaction(); // Commit the transaction
        session.endSession(); // End the session
        // Send a JSON response with the newly created comment
        res.json(comment);
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction if there is an error
        session.endSession(); // End the session
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});

// Route for removing a comment from a post
router.delete("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user; // Extract user ID from request object
    const { Comment, Post } = (req as CustomRequest).context.models; // Get Comment and Post models from request context
    const session = await mongoose.startSession(); // Start a Mongoose session
    session.startTransaction(); // Start a transaction within the session
    try {
        // Delete a comment only if it belongs to the authenticated user
        let comment = await Comment.deleteOne({ "_id": req.body.comment, "sender": _id }).session(session);
        // Remove the comment's ID from the post's "comments" array
        Post.updateOne({ "_id": req.body.post }, { $pull: { "comments": req.body.comment } }).session(session);
        await session.commitTransaction(); // Commit the transaction
        session.endSession(); // End the session
        // Send a JSON response with the result of the comment deletion
        res.json(comment);
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction if there is an error
        session.endSession(); // End the session
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});


// This route is used to like a comment
router.post("/like_comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Comment } = (req as CustomRequest).context.models;

    // Start a new session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the comment with the provided ID
        let comment = await Comment.findOne({ "_id": req.body.comment }).session(session);

        // If the user hasn't already liked the comment, increment the like count and add the user to the list of liked users
        if (!comment.like_users.includes(_id) && !comment.dislike_users.includes(_id)) {
            await Comment.updateOne({ "_id": comment._id }, { $inc: { "like_count": 1 }, $push: { "like_users": _id } }).session(session);
        }

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        // Return the updated comment object
        res.json(comment);
    } catch (error) {
        // If there's an error, abort the transaction and end the session
        await session.abortTransaction();
        session.endSession();
        // Return an error response
        res.status(400).json({ error });
    }
});

// This route is used to unlike a comment
router.post("/unlike_comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Comment } = (req as CustomRequest).context.models;

    // Start a new session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the comment with the provided ID
        let comment = await Comment.findOne({ "_id": req.body.comment }).session(session);

        // If the user has already liked the comment, decrement the like count and remove the user from the list of liked users
        if (comment.like_users.includes(_id)) {
            await Comment.updateOne({ "_id": comment._id }, { $inc: { "like_count": -1 }, $pull: { "like_users": _id } }).session(session);
        }

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        // Return the updated comment object
        res.json(comment);
    } catch (error) {
        // If there's an error, abort the transaction and end the session
        await session.abortTransaction();
        session.endSession();
        // Return an error response
        res.status(400).json({ error });
    }
});

// This route is used to dislike a comment
router.post("/dislike_comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Comment } = (req as CustomRequest).context.models;

    // Start a new session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the comment with the provided ID
        let comment = await Comment.findOne({ "_id": req.body.comment }).session(session);

        // If the user hasn't already disliked the comment, increment the dislike count and add the user to the list of disliked users
        if (!comment.dislike_users.includes(_id) && !comment.like_users.includes(_id)) {
            await Comment.updateOne({ "_id": comment._id }, { $inc: { "dislike_count": 1 }, $push: { "dislike_users": _id } }).session(session);
        }

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        // Return the updated comment object
        res.json(comment);
    } catch (error) {
        // If there's an error, abort the transaction and end the session
        await session.abortTransaction();
        session.endSession();
        // Return an error response
        res.status(400).json({ error });
    }
});

// This route is used to undislike a comment
router.post("/undislike_comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Comment } = (req as CustomRequest).context.models;

    // Start a new session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the comment with the provided ID
        let comment = await Comment.findOne({ "_id": req.body.comment }).session(session);

        // If the user has already disliked the comment, decrement the dislike count and remove the user from the list of disdisliked users
        if (comment.dislike_users.includes(_id)) {
            await Comment.updateOne({ "_id": comment._id }, { $inc: { "dislike_count": -1 }, $pull: { "dislike_users": _id } }).session(session);
        }

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        // Return the updated comment object
        res.json(comment);
    } catch (error) {
        // If there's an error, abort the transaction and end the session
        await session.abortTransaction();
        session.endSession();
        // Return an error response
        res.status(400).json({ error });
    }
});

// This route is used to retrieve a single comment by its ID
router.get("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Comment } = (req as CustomRequest).context.models;
    try {
        // Find the comment with the provided ID from the request header
        let comment = await Comment.findOne({ "_id": req.headers.comment })
        let liked;
        // Check if the current user has already liked the comment
        if (comment.like_users.includes(_id)) {
            liked = true
        }
        else {
            liked = false
        }
        // Remove the 'like_users' field from the comment object and add the 'liked' field
        delete comment.like_users;
        comment.liked = liked;
        // Return the comment object as a response
        res.json(comment);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});

// This route is used to retrieve a page of comments for a single post
router.get("/comments", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { Post, Comment } = (req as CustomRequest).context.models;
    try {
        // Find the post with the provided ID from the request header
        let post = await Post.findOne({ "_id": req.headers.post });
        // Slice the comments array to get a page of comments
        //const page = post.comments.slice(req.headers.page * 20, req.headers.page * 20 + 20);
        // Find all the comments in the current page
        let comments = await Comment.find({ '_id': { $in: post.comments } }).limit(20).skip(20 * parseInt(req.headers.page));
        // Add a 'liked' field to each comment object based on whether the current user has already liked the comment
        for (var i = 0; i < comments.length; i++) {
            let liked;
            if (comments[i].like_users.includes(_id)) {
                liked = true
            }
            else {
                liked = false
            }
            delete comments[i].like_users;
            comments[i].liked = liked;
        }
        // Return the array of comments as a response
        res.json(comments);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});
// Route for removing a post
router.delete("/post", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user; // Get the user ID from the request object
    const { User, Comment, Post } = (req as CustomRequest).context.models; // Get the User, Comment, and Post models from the request context object
    const session = await mongoose.startSession(); // Start a new Mongoose session
    session.startTransaction(); // Start a transaction for the session
    try {
        let post = await Post.findOneAndDelete({ "_id": req.body.post, "author": _id }).session(session); // Find and delete the post that matches the ID and author
        await User.updateOne({ "_id": _id }, { $pull: { "posts": req.body.post } }).session(session); // Remove the post ID from the user's posts array
        await Comment.deleteMany({ "_id": { $in: post.comments } }).session(session); // Delete all comments associated with the post

        //Post.updateOne({ "_id": req.body.post }, { $pull: { "comments": req.body.comment } }).session(session); // Remove the comment ID from the post's comments array
        await session.commitTransaction(); // Commit the transaction
        session.endSession(); // End the session

        res.json({ acknowleged: true }); // Send a JSON response to the client indicating success
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction if there is an error
        session.endSession(); // End the session
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});



// This route is used to retrieve a page of posts
router.post("/posts", middleware.isLoggedIn, async (req: any, res) => {
    const { _id } = (req as CustomRequest).user;
    const { User, Post, Friends, Following } = (req as CustomRequest).context.models;
    try {
        let seen = JSON.parse(req.body.seen);
        // Find the user with the provided ID
        let user = await User.findOne({ '_id': _id })
        // Find the friends of the user
        let friends = await Friends.find({ 'owner': _id })
        let friendsArray = [];
        for (let i = 0; i < friends.length; i++) {
            friendsArray.push(friends[i].user);
        }

        // Find posts that the user has not seen, have not been liked by the user, and were posted by a friend
        let posts = await Post.find({ '_id': { $nin: seen }, 'like_users': { $nin: _id }, 'author': { $in: friendsArray } }).sort({ date: -1 }).limit(20);
        // If there are not enough posts from friends, find posts from users that the user is following
        let fetchedIds = []
        for(let i = 0; i < posts.length; i++) {
fetchedIds.push(posts[i]["_id"])

        }
        if (posts.length < 20) {
            let following = await Following.find({ 'owner': _id })
            let followingArray = [];
            for (let i = 0; i < following.length; i++) {
                followingArray.push(following[i].user);
            }
            let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'like_users': { $nin: _id }, 'author': { $in: followingArray } }).sort({ date: -1 }).limit(20 - posts.length);
            for(let i = 0; i < other_posts.length; i++) {
                fetchedIds.push(other_posts[i]["_id"])
                
                        }
            posts = posts.concat(other_posts)

        }
        // If there are still not enough posts, find posts from a random friend of a friend (if they are not private)
        if (posts.length < 20 && friends.length != 0) {
            let index = Math.floor(Math.random() * friends.length);
            let randUser = await User.findOne({ '_id': friends[index].user })
            if (randUser ? !randUser.private : false) {
                let randFriends = await Friends.find({ 'owner': randUser._id })
                let randFriendsArray = [];
                for (var i = 0, randFriend = randFriends[i]; i < randFriends.length; i++) {
                    if (randFriend.user != _id) {
                        randFriendsArray.push(randFriend.user);
                    }
                }
                if (randFriendsArray.length != 0) {
                    let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'like_users': { $nin: _id }, 'author': { $in: randFriendsArray } }).sort({ date: -1 }).limit(20 - posts.length);
                    for(let i = 0; i < other_posts.length; i++) {
                        fetchedIds.push(other_posts[i]["_id"])
                        
                                }
                    posts = posts.concat(other_posts)
                }
            }
        }
        if (posts.length < 20) {
            let following = await Following.find({ 'owner': _id })
            let followingArray = [];
            for (let i = 0; i < following.length; i++) {
                followingArray.push(following[i].user);
            }
            let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'author': { $in: [...followingArray, ...friendsArray] } }).sort({ date: -1 }).limit(20 - posts.length);
            posts = posts.concat(other_posts)
        }
        // Remove like_users and comments from each post
        let returnPosts = [] as Array<IreturnPost>
        for (var i = 0; i < posts.length; i++) {
            let returnPost = {} as IreturnPost
            returnPost.comment_count = posts[i].comments.length
            returnPost.liked = false

            returnPost._id = posts[i]._id
            returnPost.description = posts[i].description
            returnPost.author = posts[i].author
            returnPost.image = posts[i].image
            returnPost.date = posts[i].date
            returnPost.like_count = posts[i].like_count
            
            if (posts[i].like_users.some((likedUser: any) => likedUser == _id)) {
                returnPost.liked = true
  /* vendors contains the element we're looking for */
}
returnPosts.push(returnPost)
        }
        // Return the array of posts as a response
        res.json(returnPosts);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});


// This is a route handler for GET requests to "/user_posts"
router.get("/user_posts", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object
    const { _id } = (req as CustomRequest).user;

    // Get the Post model from the context object
    const { Post } = (req as CustomRequest).context.models;

    try {
        // Query the database for posts authored by the current user, sorted by date in descending order
        // The "skip" and "limit" options are used for pagination
        let posts = await Post.find({ 'author': req.headers.user ?? _id, }).sort({ date: -1 }).skip(20 * req.headers.page).limit(20);

        // Loop through each post and add a "comment_count" property to it
        for (var i = 0; i < posts.length; i++) {
            posts[i].comment_count = posts[i].comments.length

            // Delete the "like_users" and "comments" properties from each post object
            // to avoid sending unnecessary data over the network
            delete posts[i].like_users;
            delete posts[i].comments;
        }

        // Send the posts data as a JSON response
        res.json(posts);
    } catch (error) {
        // Send a 400 Bad Request response if there was an error
        res.status(400).json({ error });
    }
});


export default router;