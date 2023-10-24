require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import mongoose from "../db/connection";
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import * as fs from 'fs';
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import { Prisma, users } from "@prisma/client";

const router = Router(); // create router to create route bundle

//DESTRUCTURE ENV VARIABLES WITH DEFAULTS
const { SECRET = "secret" } = process.env;


// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});

let influencers: bigint[] = [];
let timeSinceLastInfluencerUpdate = 0;
const getInfluencers = () => {
    try {
        if (timeSinceLastInfluencerUpdate + 2.16e+7 < Date.now()) {
            const jsonString = fs.readFileSync('./influencers.json', 'utf-8');
            influencers = JSON.parse(jsonString);
            timeSinceLastInfluencerUpdate = Date.now();
        }
    } catch (err) {
        console.error(err);
    }
}
// Define a route to create a new post, with middleware to check if the user is logged in
router.post("/post", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user ID from the authenticated user object
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Create a new post, including the author ID, description, image, and date
        const post = await prisma.posts.create({
            data: {
                post_id: generator.nextId(),
                author_id: BigInt(_id),
                description: req.body.description,
                image: req.body.image,
                like_count: 0


            }
        });
        // Return the new post as a JSON response
        res.json(post);
    } catch (error) {
        // Return an error response
        res.status(400).json({ error });
    }
});


// Define a route to return a post from a given id, with middleware to check if the user is logged in
router.get("/post", middleware.isLoggedIn, async (req: any, res) => {
    // TODO: ADD PRIVATE POST OPTION & FOLLOWERS / FRIENDS ONLY
    // Get the user ID from the authenticated user object
    try {
        // Get post
        const post = await prisma.posts.findUnique({ where: { post_id: BigInt(req.headers.post) } })
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
    const _id = BigInt((req as CustomRequest).user._id);


    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        const postLike = await prisma.post_likes.findFirst({ where: { post_id: BigInt(req.body.post), user_id: _id } })
        if (!postLike) {
            try {
                await prisma.$transaction(async (tx) => {
                    const post = await tx.posts.update({
                        where: { post_id: BigInt(req.body.post) }, data: {
                            like_count: { increment: 1 }, post_likes: {

                            }
                        }
                    })

                    // Create a new record in TableB within the transaction
                    const postLikeNew = await tx.post_likes.create({
                        data: {
                            like_id: generator.nextId(),
                            post_id: post.post_id,
                            user_id: _id

                            // Provide the data for the new record in TableB
                        },
                    });
                    return res.json({ "post": post, "like": postLikeNew })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }

        // Send the updated post back to the client.
        res.json({ "error": "Post already liked" });
    } catch (error) {
        res.status(400).json({ error });
    }
});

// Define a route to the '/unlike' endpoint.
router.post("/unlike", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object.
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        const postLike = await prisma.post_likes.findFirst({ where: { post_id: BigInt(req.body.post), user_id: _id } })
        if (postLike) {
            try {
                await prisma.$transaction(async (tx) => {
                    const post = await tx.posts.update({
                        where: { post_id: BigInt(req.body.post) }, data: {
                            like_count: { decrement: 1 }, post_likes: {

                            }
                        }
                    })

                    // Create a new record in TableB within the transaction
                    const postLikeNew = await tx.post_likes.delete({
                        where: {
                            like_id: postLike.like_id

                            // Provide the data for the new record in TableB
                        },
                    });
                    return res.json({ "post": post, "like": postLikeNew })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }

        // Send the updated post back to the client.
        res.json({ "error": "Post isn't liked" });
    } catch (error) {

        res.status(400).json({ error });
    }
});

//TODO ADD SAVED POSTS (MISSING IN DB)
// // Route for saving a post to a user's saved_posts array
// router.post("/save", middleware.isLoggedIn, async (req: any, res) => {
//     const _id = BigInt((req as CustomRequest).user._id); // Extract user ID from request object
//     const { User } = (req as CustomRequest).context.models; // Get User model from request context
//     const session = await mongoose.startSession(); // Start a Mongoose session
//     session.startTransaction(); // Start a transaction within the session
//     try {
//         prisma.pos
//         // Update the User document with the new saved post
//         let t = await User.updateOne({ "_id": _id }, { $push: { "saved_posts": BigInt(req.body.post) } }).session(session);
//         await session.commitTransaction(); // Commit the transaction
//         session.endSession(); // End the session
//         res.json(t); // Send a JSON response with the update result
//     } catch (error) {
//         await session.abortTransaction(); // Rollback the transaction if there is an error
//         session.endSession(); // End the session
//         res.status(400).json({ error }); // Send a 400 response with the error message
//     }
// });

// // Route for removing a post from a user's saved_posts array
// router.post("/unsave", middleware.isLoggedIn, async (req: any, res) => {
//     const _id = BigInt((req as CustomRequest).user._id); // Extract user ID from request object
//     const { User } = (req as CustomRequest).context.models; // Get User model from request context
//     const session = await mongoose.startSession(); // Start a Mongoose session
//     session.startTransaction(); // Start a transaction within the session
//     try {
//         // Update the User document by removing the specified saved post
//         let t = await User.updateOne({ "_id": _id }, { $pull: { "saved_posts": BigInt(req.body.post) } }).session(session);
//         await session.commitTransaction(); // Commit the transaction
//         session.endSession(); // End the session
//         res.json(t); // Send a JSON response with the update result
//     } catch (error) {
//         await session.abortTransaction(); // Rollback the transaction if there is an error
//         session.endSession(); // End the session
//         res.status(400).json({ error }); // Send a 400 response with the error message
//     }
// });

// Route for adding a comment to a post
router.post("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id); // Extract user ID from request object

    try {
        const comment = await prisma.comments.create({
            data: {
                comment_id: generator.nextId(),
                post_id: BigInt(req.body.post),
                sender_id: _id,
                //TODO you forgot to put comment text you dimwit lol (req.body.content)
                timestamp: new Date(),
                like_count: 0

            }
        })
        // Send a JSON response with the newly created comment
        res.json(comment);
    } catch (error) {
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});

// Route for removing a comment from a post
router.delete("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id); // Extract user ID from request object
    try {
        const comment = await prisma.comments.delete({
            where: {
                comment_id: BigInt(req.body.comment)
            }
        })

        // Send a JSON response with the result of the comment deletion
        res.json(comment);
    } catch (error) {
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});


// This route is used to like a comment
router.post("/like_comment", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);


    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        const commentLike = await prisma.comment_likes.findFirst({ where: { comment_id: BigInt(req.body.comment), user_id: _id } })
        if (!commentLike) {
            try {
                await prisma.$transaction(async (tx) => {
                    const comment = await tx.comments.update({
                        where: { comment_id: BigInt(req.body.comment) }, data: {
                            like_count: { increment: 1 }, comment_likes: {

                            }
                        }
                    })

                    // Create a new record in Comment likes within the transaction
                    const commentLikeNew = await tx.comment_likes.create({
                        data: {
                            like_id: generator.nextId(),
                            comment_id: comment.post_id,
                            user_id: _id

                            // Provide the data for the new record in TableB
                        },
                    });
                    return res.json({ "comment": comment, "like": commentLikeNew })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }

        // Send the updated post back to the client.
        res.json({ "error": "Comment isn't liked" });
    } catch (error) {

        // Return an error response
        res.status(400).json({ error });
    }
});

// This route is used to unlike a comment
router.post("/unlike_comment", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Find the post that the user is trying to like, using the ID from the request body.
        const commentLike = await prisma.comment_likes.findFirst({ where: { comment_id: BigInt(req.body.comment), user_id: _id } })
        if (commentLike) {
            try {
                await prisma.$transaction(async (tx) => {
                    const comment = await tx.comments.update({
                        where: { comment_id: BigInt(req.body.comment) }, data: {
                            like_count: { decrement: 1 }, comment_likes: {

                            }
                        }
                    })

                    // Create a new record in Comment likes within the transaction
                    const commentLikeNew = await tx.comment_likes.delete({
                        where: {
                            like_id: commentLike.like_id

                            // Provide the data for the new record in TableB
                        },
                    });
                    return res.json({ "comment": comment, "like": commentLikeNew })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }

        // Send the updated post back to the client.
        res.json({ "error": "Comment isn't liked" });
    } catch (error) {

        // Return an error response
        res.status(400).json({ error });
    }
});

//TODO Add dislike comment
// // This route is used to dislike a comment
// router.post("/dislike_comment", middleware.isLoggedIn, async (req: any, res) => {
//     const _id = BigInt((req as CustomRequest).user._id);
//     const { Comment } = (req as CustomRequest).context.models;

//     // Start a new session and transaction
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         // Find the comment with the provided ID
//         let comment = await Comment.findOne({ "_id": BigInt(req.body.comment) }).session(session);

//         // If the user hasn't already disliked the comment, increment the dislike count and add the user to the list of disliked users
//         if (!comment.dislike_users.includes(_id) && !comment.like_users.includes(_id)) {
//             await Comment.updateOne({ "_id": comment._id }, { $inc: { "dislike_count": 1 }, $push: { "dislike_users": _id } }).session(session);
//         }

//         // Commit the transaction and end the session
//         await session.commitTransaction();
//         session.endSession();

//         // Return the updated comment object
//         res.json(comment);
//     } catch (error) {
//         // If there's an error, abort the transaction and end the session
//         await session.abortTransaction();
//         session.endSession();
//         // Return an error response
//         res.status(400).json({ error });
//     }
// });

// // This route is used to undislike a comment
// router.post("/undislike_comment", middleware.isLoggedIn, async (req: any, res) => {
//     const _id = BigInt((req as CustomRequest).user._id);
//     const { Comment } = (req as CustomRequest).context.models;

//     // Start a new session and transaction
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         // Find the comment with the provided ID
//         let comment = await Comment.findOne({ "_id": BigInt(req.body.comment) }).session(session);

//         // If the user has already disliked the comment, decrement the dislike count and remove the user from the list of disdisliked users
//         if (comment.dislike_users.includes(_id)) {
//             await Comment.updateOne({ "_id": comment._id }, { $inc: { "dislike_count": -1 }, $pull: { "dislike_users": _id } }).session(session);
//         }

//         // Commit the transaction and end the session
//         await session.commitTransaction();
//         session.endSession();

//         // Return the updated comment object
//         res.json(comment);
//     } catch (error) {
//         // If there's an error, abort the transaction and end the session
//         await session.abortTransaction();
//         session.endSession();
//         // Return an error response
//         res.status(400).json({ error });
//     }
// });

// This route is used to retrieve a single comment by its ID
router.get("/comment", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);
    try {
        // Find the comment with the provided ID from the request header
        const comment = prisma.comments.findFirst({ where: { comment_id: BigInt(req.headers.comment) }, include: { comment_likes: { where: { user_id: _id } } } })

        // Return the comment object as a response
        res.json(comment);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});

// This route is used to retrieve a page of comments for a single post
router.get("/comments", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id);
    try {
        // Find the post with the provided ID from the request header
        const comments = await prisma.posts.findFirst({ where: { post_id: BigInt(req.headers.post) }, include: { comments: { take: 20, skip: 20 * req.headers.page, include: { comment_likes: { where: { user_id: _id } } } } } });

        // Return the array of comments as a response
        return res.json(comments);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});
// Route for removing a post
router.delete("/post", middleware.isLoggedIn, async (req: any, res) => {
    const _id = BigInt((req as CustomRequest).user._id); // Get the user ID from the request object
    try {
        const post = await prisma.posts.delete({
            where: {
                post_id: BigInt(req.body.post),
                author_id: _id

            }
        })

        res.json(post); // Send a JSON response to the client indicating success
    } catch (error) {
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});



// This route is used to retrieve a page of posts
router.post("/posts", middleware.isLoggedIn, async (req: any, res) => {
    //! NEEDS TESTING
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        let seen = JSON.parse(req.body.seen);
        const take = 20
        const skip = 20 * req.body.page
        // Find the user with the provided ID
        const posts = await prisma.$queryRaw`
        SELECT *
        FROM posts
        WHERE (author_id IN (
          SELECT following_user_id
          FROM following
          WHERE user_id = ${_id}
        )
        OR author_id IN (
          SELECT user_id
          FROM followers
          WHERE follower_user_id = ${_id}
        ) OR author_id IN (
            SELECT user1_id, user2_id
            FROM friends
            WHERE user1_id = ${_id} OR user2_id = ${_id}
        )
        ) AND
        author_id NOT IN (
            SELECT user_id
            FROM post_likes
            WHERE user_id = ${_id} AND post_id = post_id
        )
        LIMIT ${take}
        OFFSET ${skip}
      ` as users[];

        // If there are still not enough posts, find posts from a random friend of a friend (if they are not private)
        if (posts.length < 20) {
            //TODO fix offset
            const extraPosts = await prisma.$queryRaw`
SELECT p.*
FROM posts p
WHERE author_id IN (
    SELECT DISTINCT fof.friend_id
    FROM friends f
    JOIN friends fof ON (f.user1_id = fof.user1_id OR f.user1_id = fof.user2_id OR f.user2_id = fof.user1_id OR f.user2_id = fof.user2_id)
    WHERE f.user1_id = ${_id} OR f.user2_id = ${_id}
        AND f.user1_id <> fof.friend_id -- Exclude the user themselves
)
            LIMIT ${take}
            OFFSET ${skip}
          ` as any;
        }
        if (posts.length < 20) {
            getInfluencers()
            const influencerPosts = prisma.posts.findMany({ where: { author_id: { in: influencers } } })
            //let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'author': { $in: influencers, $ne: _id } }).sort({ date: -1 }).limit(20 - posts.length);
            //influencerResults = other_posts.length;
            // posts = posts.concat(other_posts)
        }
        return res.json(posts);
        // // Remove like_users and comments from each post
        // let returnPosts = [] as Array<IreturnPost>
        // let index = posts.length - influencerResults;
        // for (var i = 0; i < posts.length; i++) {
        //     let influencer = false;
        //     let initial_influencer = false;
        //     if (index == i && seen.length == 0) {
        //         initial_influencer = true;
        //     }
        //     if (i >= index) {
        //         influencer = true;

        //     }

        // let returnPost = {} as IreturnPost
        // returnPost.comment_count = posts[i].comments.length
        // returnPost.liked = false

        // returnPost._id = posts[i]._id
        // returnPost.description = posts[i].description
        // returnPost.author = posts[i].author
        // returnPost.image = posts[i].image
        // returnPost.date = posts[i].date
        // returnPost.like_count = posts[i].like_count
        // returnPost.influencer = influencer
        // returnPost.initial_influencer = initial_influencer

        // if (posts[i].like_users.some((likedUser: any) => likedUser == _id)) {
        //     returnPost.liked = true
        //     /* vendors contains the element we're looking for */
        // }
        // returnPosts.push(returnPost)
        //}
        // Return the array of posts as a response
        //res.json(returnPosts);
    } catch (error) {
        // If there's an error, return an error response
        res.status(400).json({ error });
    }
});


// This is a route handler for GET requests to "/user_posts"
router.get("/user_posts", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);


    try {
        // Query the database for posts authored by the current user, sorted by date in descending order
        // The "skip" and "limit" options are used for pagination
        const posts = await prisma.posts.findMany({ where: { author_id: BigInt(req.headers.user) }, orderBy: { post_id: Prisma.SortOrder.asc }, skip: (20 * req.headers.page), take: 20 })

        // Send the posts data as a JSON response
        res.json(posts);
    } catch (error) {
        // Send a 400 Bad Request response if there was an error
        res.status(400).json({ error });
    }
});


export default router;