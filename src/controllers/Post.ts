require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import middleware from "./middleware";
import CustomRequest from "./CustomRequest";
import * as fs from 'fs';
import prisma from "../db/postgres";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import { Prisma, posts } from "@prisma/client";
import { ErrorCode } from "../ErrorCodes";

const ec = "error_code";
const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});
type postsE = Omit<posts, 'location'> & { location: String, liked: boolean };

// Initialize an empty array to store influencer data.
let influencers: bigint[] = [];
// Initialize a variable to keep track of the time since the last influencer data update.
let timeSinceLastInfluencerUpdate = 0;

// Create a function to fetch and update influencer data from a JSON file.
const getInfluencers = () => {
    try {
        // Check if it's been more than 2.16e+7 milliseconds (6 hours) since the last update.
        if (timeSinceLastInfluencerUpdate + 2.16e+7 < Date.now()) {
            // Read the influencer data from a JSON file.
            const jsonString = fs.readFileSync('./influencers.json', 'utf-8');
            // Parse the JSON data and update the 'influencers' array.
            influencers = JSON.parse(jsonString);
            // Update the time of the last influencer data update.
            timeSinceLastInfluencerUpdate = Date.now();
        }
    } catch (err) {
        console.error(err);
    }
}

// Create an API endpoint for handling a POST request related to creating a new post.
router.post("/post", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request.
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Create a new post using the Prisma ORM.
        const post = await prisma.posts.create({
            data: {
                post_id: generator.nextId(), // Generate a unique post ID.
                author_id: BigInt(_id), // Set the author's ID.
                description: req.body.description, // Extract post description from the request.
                image: req.body.image, // Extract post image hash from the request.
                like_count: 0 // Initialize the like count to 0.
            }
        });

        // Respond with the newly created post.
        res.json(post);
    } catch (error) {
        // Handle errors by sending a 400 (Bad Request) response with the error message.
        res.status(400).json({ error });
    }
});



// Define a route that listens for HTTP GET requests at the "/post" endpoint.
router.get("/post", middleware.isLoggedIn, async (req: any, res) => {
    // TODO: ADD PRIVATE POST OPTION & FOLLOWERS / FRIENDS ONLY

    try {

        // Use Prisma to query the database for a specific post based on the post_id provided in the request headers.
        const post = await prisma.posts.findUnique({ where: { post_id: BigInt(req.headers.post) } })

        // Send a JSON response containing the retrieved post to the client.
        res.json(post);
    } catch (error) {
        // Set the response status code to 400 (Bad Request) to indicate an error.
        res.status(400).json({ error });
    }
});




router.post("/like", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Check if the user has already liked the post
        const postLike = await prisma.post_likes.findFirst({ where: { post_id: BigInt(req.body.post), user_id: _id } })
        if (!postLike) {
            try {
                // Begin a database transaction
                await prisma.$transaction(async (tx) => {
                    // Increment the like count of the post and create a new like record
                    const post = await tx.posts.update({
                        where: { post_id: BigInt(req.body.post) },
                        data: {
                            like_count: { increment: 1 },
                            post_likes: {}
                        }
                    })

                    const postLikeNew = await tx.post_likes.create({
                        data: {
                            like_id: generator.nextId(),
                            post_id: post.post_id,
                            user_id: _id
                        },
                    });
                    return res.status(200).json({ "success": true })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }
        else {

            // If the user has already liked the post, return an error
            return res.status(400).json({ "error": "Post already liked" });
        }
    } catch (error) {
        // Handle any other errors with a 400 status code
        res.status(400).json({ error });
    }
});

// Define a route for unliking a post
router.post("/unlike", middleware.isLoggedIn, async (req: any, res) => {
    // Get the user's ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Check if the user has already liked the post
        const postLike = await prisma.post_likes.findFirst({ where: { post_id: BigInt(req.body.post), user_id: _id } })
        if (postLike) {
            try {
                // Begin a database transaction
                await prisma.$transaction(async (tx) => {
                    // Decrement the like count of the post and delete the like record
                    const post = await tx.posts.update({
                        where: { post_id: BigInt(req.body.post) },
                        data: {
                            like_count: { decrement: 1 },
                            post_likes: {}
                        }
                    })

                    const postLikeNew = await tx.post_likes.delete({
                        where: {
                            like_id: postLike.like_id
                        },
                    });
                    return res.status(200).json({ "success": true })
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }

        else {

            // If the user hasn't liked the post, return an error
            return res.status(400).json({ "error": "Post isn't liked" });
        }
    } catch (error) {
        // Handle any other errors with a 400 status code
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

// Define a route to create a new comment
router.post("/comment", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Create a new comment using Prisma
        const comment = await prisma.comments.create({
            data: {
                comment_id: generator.nextId(), // Generate a unique comment ID
                post_id: BigInt(req.body.post), // Extract the post ID from the request
                sender_id: _id, // Set the sender's user ID
                content: req.body.content, // Extract the comment content from the request
                timestamp: new Date().toISOString(), // Set the current timestamp
                like_count: 0 // Initialize the like count to 0
            }
        });

        // Send the created comment as a JSON response
        res.json(comment);
    } catch (error) {
        // Handle errors by sending a 400 status and an error message
        res.status(400).json({ error });
    }
});

// Define a route to delete a comment
router.delete("/comment", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Delete a comment by its comment_id
        const comment = await prisma.comments.delete({
            where: {
                comment_id: BigInt(req.body.comment) // Extract the comment ID from the request
            }
        });

        // Send a success message as a JSON response
        res.status(200).json({ "success": true });
    } catch (error) {
        // Handle errors by sending a 400 status and an error message
        res.status(400).json({ error });
    }
});

// Define a route to like a comment
router.post("/like_comment", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Check if the user has already liked the comment
        const commentLike = await prisma.comment_likes.findFirst({ where: { comment_id: BigInt(req.body.comment), user_id: _id } });

        if (!commentLike) {
            try {
                // Use a transaction to update the comment's like count and create a new comment_like entry
                await prisma.$transaction(async (tx) => {
                    const comment = await tx.comments.update({
                        where: { comment_id: BigInt(req.body.comment) },
                        data: {
                            like_count: { increment: 1 } // Increment the like count by 1
                        }
                    });

                    const commentLikeNew = await tx.comment_likes.create({
                        data: {
                            like_id: generator.nextId(), // Generate a unique like ID
                            comment_id: comment.post_id, // Set the comment ID
                            user_id: _id // Set the user ID
                        },
                    });

                    // Send a success message as a JSON response
                    return res.status(200).json({ "success": true });
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }
        else {

            // Send an error message if the comment is already liked
            return res.json({ "error": "Comment already liked" });
        }
    } catch (error) {
        // Handle errors by sending a 400 status and an error message
        res.status(400).json({ error });
    }
});

// Define a route to unlike a comment
router.post("/unlike_comment", middleware.isLoggedIn, async (req: any, res) => {
    // Extract the user ID from the request
    const _id = BigInt((req as CustomRequest).user._id);

    try {
        // Check if the user has already liked the comment
        const commentLike = await prisma.comment_likes.findFirst({ where: { comment_id: BigInt(req.body.comment), user_id: _id } });

        if (commentLike) {
            try {
                // Use a transaction to update the comment's like count and delete the comment_like entry
                await prisma.$transaction(async (tx) => {
                    const comment = await tx.comments.update({
                        where: { comment_id: BigInt(req.body.comment) },
                        data: {
                            like_count: { decrement: 1 } // Decrement the like count by 1
                        }
                    });

                    const commentLikeNew = await tx.comment_likes.delete({
                        where: {
                            like_id: commentLike.like_id // Delete the comment_like entry using its ID
                        },
                    });

                    // Send a success message as a JSON response
                    return res.status(200).json({ "success": true });
                });
            } catch (error) {
                console.error('Error in transaction:', error);
            }
        }
        else {
            // Send an error message if the comment is not liked
            return res.json({ "error": "Comment isn't liked" });
        }
    } catch (error) {
        // Handle errors by sending a 400 status and an error message
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
        if (comments) {
            // Return the array of comments as a response
            return res.status(200).json(comments.comments);
        }
        else {
            return res.status(400).json({ ec: ErrorCode.RecordNotFound })
        }
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

        res.status(200).json({ "success": true }); // Send a JSON response to the client indicating success
    } catch (error) {
        // Send a 400 response with the error message
        res.status(400).json({ error });
    }
});



// This route is used to retrieve a page of posts
router.post("/posts", middleware.isLoggedIn, async (req: any, res) => {
    //! NEEDS TESTING
    const _id = BigInt((req as CustomRequest).user._id);

    //try {
    //let seen = JSON.parse(req.body.seen);
    const take = 20
    const skip = 20 * parseInt(req.body.page)
    let remaining = 20
    let finalPosts: postsE[] = []
    // Find the user with the provided ID
    finalPosts = await prisma.$queryRaw`
        SELECT 
            p.post_id, 
            p.author_id, 
            p.description, 
            p.image, 
            p.like_count, 
            p.friends_only, 
            p."location"::text,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM post_likes pl 
                    WHERE pl.user_id = ${_id} AND pl.post_id = p.post_id
                ) THEN 1
                ELSE 0
            END AS liked
        FROM posts p
        WHERE (
            p.author_id IN (
                SELECT following_user_id
                FROM following
                WHERE user_id = ${_id}
            )
            OR p.author_id IN (
                SELECT user_id
                FROM followers
                WHERE follower_user_id = ${_id}
            )
            OR p.author_id IN (
                SELECT 
                    CASE
                        WHEN user1_id = ${_id} THEN user2_id
                        ELSE user1_id
                    END AS friend_id
                FROM friends
                WHERE user1_id = ${_id} OR user2_id = ${_id}
            )
        ) 
        AND NOT EXISTS (
            SELECT 1
            FROM post_likes pl
            WHERE pl.user_id = ${_id} AND pl.post_id = p.post_id
        )
        LIMIT ${remaining}
        OFFSET ${skip};
      ` as postsE[];

    // If there are still not enough posts, find posts from a random friend of a friend (if they are not private)
    if (finalPosts.length < 20) {
        remaining = remaining - finalPosts.length
        //TODO fix offset
        const extraPosts = await prisma.$queryRaw`
            SELECT 
                p.post_id, 
                p.author_id, 
                p.description, 
                p.image, 
                p.like_count, 
                p.friends_only, 
                p."location"::text,
                EXISTS (
                    SELECT 1 
                    FROM post_likes pl 
                    WHERE pl.post_id = p.post_id AND pl.user_id = ${_id}
                ) AS liked
            FROM posts p
            WHERE author_id IN (
                SELECT DISTINCT friend_id
                FROM (
                    SELECT DISTINCT f.user1_id AS friend_id
                    FROM friends f
                    WHERE (f.user2_id = ${_id} OR f.user1_id = ${_id})
                    UNION
                    SELECT DISTINCT f.user2_id AS friend_id
                    FROM friends f
                    WHERE (f.user1_id = ${_id} OR f.user2_id = ${_id})
                ) AS subq
                WHERE subq.friend_id <> ${_id} -- Exclude the user themselves
            )
            LIMIT ${remaining}
            OFFSET ${skip}
          ` as postsE[];
        finalPosts = [...finalPosts, ...extraPosts]
        remaining -= extraPosts.length;
    }
    if (finalPosts.length < 20) {
        //TODO NEEDS FURTHER TESTING
        getInfluencers()
        const influencerPosts = await prisma.posts.findMany({
            where: { author_id: { in: influencers } },
            select: {
                post_id: true,
                author_id: true,
                description: true,
                image: true,
                like_count: true,
                friends_only: true,
                // Add a custom field to check if the user has liked the post
                post_likes: {
                    select: {
                        user_id: true,
                    },
                    where: {
                        user_id: _id,
                    },
                },
            },
            take: remaining,
            skip: skip
        });
        let influencerPostsFormatted: postsE[] = []

        for (const post of influencerPosts) {
            influencerPostsFormatted.push({
                post_id: post.post_id,
                author_id: post.author_id,
                description: post.description,
                image: post.image,
                like_count: post.like_count,
                friends_only: post.friends_only,
                location: "",
                liked: (post.post_likes.length > 0)
            })
        }

        //let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'author': { $in: influencers, $ne: _id } }).sort({ date: -1 }).limit(20 - posts.length);
        //influencerResults = other_posts.length;
        // posts = posts.concat(other_posts)
        finalPosts = [...finalPosts, ...influencerPostsFormatted]
        remaining -= influencerPostsFormatted.length;
    }
    if (finalPosts.length < 20) {
        //TODO NEEDS FURTHER TESTING

        const userLikedPosts = await prisma.post_likes.findMany({
            where: {
                user_id: _id, // Replace 'userId' with the actual user's ID
            },
            include: {
                posts: true,
            },
            skip: skip, // Calculate how many records to skip
            take: remaining, // Set the number of records to retrieve
        });

        console.log(userLikedPosts);

        let influencerPostsFormatted: postsE[] = []

        for (const post of userLikedPosts) {
            influencerPostsFormatted.push({
                post_id: post.posts.post_id,
                author_id: post.posts.author_id,
                description: post.posts.description,
                image: post.posts.image,
                like_count: post.posts.like_count,
                friends_only: post.posts.friends_only,
                location: "",
                liked: true
            })
        }

        //let other_posts = await Post.find({ '_id': { $nin: [...fetchedIds, ...seen] }, 'author': { $in: influencers, $ne: _id } }).sort({ date: -1 }).limit(20 - posts.length);
        //influencerResults = other_posts.length;
        // posts = posts.concat(other_posts)
        finalPosts = [...finalPosts, ...influencerPostsFormatted]
    }
    let returnPosts: postsE[] = []
    for (const post of finalPosts) {
        let e = post
        e.liked = Boolean(post.liked)
        returnPosts.push(e);
    }
    return res.json(returnPosts);
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
    // } catch (error) {
    //     // If there's an error, return an error response
    //     res.status(400).json({ error });
    // }
});


// This is a route handler for GET requests to "/user_posts"
router.get("/user_posts", middleware.isLoggedIn, async (req: any, res) => {

    // Extract the user ID from the request object
    const _id = BigInt((req as CustomRequest).user._id);


    //try {
    // Query the database for posts authored by the current user, sorted by date in descending order
    // The "skip" and "limit" options are used for pagination
    const posts = await prisma.posts.findMany({ where: { author_id: BigInt(req.headers.user) }, orderBy: { post_id: Prisma.SortOrder.asc }, skip: (20 * req.headers.page), take: 20 })

    // Send the posts data as a JSON response
    res.json(posts);
    // } catch (error) {
    //     // Send a 400 Bad Request response if there was an error
    //     res.status(400).json({ error });
    // }
});


export default router;