require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express

import * as fs from "fs";
import prisma from "../db/postgres";
import { Worker } from "snowflake-uuid"; // Import a unique ID generator library
import { Prisma, posts } from "@prisma/client";
import { ErrorCode } from "../ErrorCodes";
import HandleBlocks from "../utils/handleBlocks";
import CheckNulls from "../utils/checkNulls";
import RouteBuilder from "../utils/RouteBuilder";
import UserNotFoundError from "../Exceptions/Client/UserNotFoundError";
import UserBlockedError from "../Exceptions/Client/UserBlockedError";
import InvalidIdError from "../Exceptions/Client/InvalidIdError";
import ClientError from "../Exceptions/Client/ClientError";
import TransactionHandler from "../utils/transactionHandler";

const ec = "error_code";
const router = Router(); // create router to create route bundle

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
  workerIdBits: 5,
  datacenterIdBits: 5,
  sequenceBits: 12,
});
type postsE = Omit<posts, "location"> & {
  location: String;
  liked: boolean;
  comment_count: bigint;
  total_likes: bigint;
  saved: boolean;
  influencer?: boolean;
};

// Initialize an empty array to store influencer data.
let influencers: bigint[] = [];
// Initialize a variable to keep track of the time since the last influencer data update.
let timeSinceLastInfluencerUpdate = 0;

// Create a function to fetch and update influencer data from a JSON file.
const getInfluencers = () => {
  try {
    // Check if it's been more than 2.16e+7 milliseconds (6 hours) since the last update.
    if (timeSinceLastInfluencerUpdate + 2.16e7 < Date.now()) {
      // Read the influencer data from a JSON file.
      const jsonString = fs.readFileSync("./influencers.json", "utf-8");
      // Parse the JSON data and update the 'influencers' array.
      influencers = JSON.parse(jsonString);
      // Update the time of the last influencer data update.
      timeSinceLastInfluencerUpdate = Date.now();
    }
  } catch (err) {
    console.error(err);
  }
};

// Create an API endpoint for handling a POST request related to creating a new post.
router.post(
  "/post",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Create a new post using the Prisma ORM.
    const post = await prisma.posts.create({
      data: {
        post_id: generator.nextId(), // Generate a unique post ID.
        author_id: req.userId!, // Set the author's ID.
        description: req.body.description, // Extract post description from the request.
        image: req.body.image, // Extract post image hash from the request.
        like_count: 0, // Initialize the like count to 0.
        timestamp: new Date().toISOString(),
      },
    });

    // Respond with the newly created post.
    res.json(post);
  })
);

// Define a route that listens for HTTP GET requests at the "/post" endpoint.
router.get(
  "/post",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // TODO: ADD PRIVATE POST OPTION & FOLLOWERS / FRIENDS ONLY

    // Use Prisma to query the database for a specific post based on the post_id provided in the request headers.
    const postId = InvalidIdError.convertToBigInt(req.headers.post);
    const post = await prisma.posts.findUnique({
      where: { post_id: postId },
      include: {
        _count: { select: { comments: true, post_likes: true } },
        saved_posts: {
          where: { user_id: req.userId },
        },
        post_likes: {
          where: { user_id: req.userId },
        },
      },
    });
    if (post) {
      const postFormatted = {
        post_id: post.post_id,
        author_id: post.author_id,
        description: post.description,
        image: post.image,
        friends_only: post.friends_only,
        location: "",
        like_count: post._count.post_likes,
        comment_count: post._count.comments,
        saved: post.saved_posts.length > 0 ? true : false,
        liked: post.post_likes.length > 0 ? true : false,
      };
      return res.json(postFormatted);
    }

    // Send a JSON response containing the retrieved post to the client.
    return res.json(post);
  })
);

router.post(
  "/like",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const postId = InvalidIdError.convertToBigInt(req.body.post);
    // Check if the user has already liked the post
    const postLike = await prisma.post_likes.findFirst({
      where: {
        post_id: postId,
        user_id: req.userId,
      },
    });
    if (!postLike) {
      // TODO handle no update registered.
      // Begin a database transaction
      await TransactionHandler.createTransactionArray(prisma, [
        // Increment the like count of the post and create a new like record
        prisma.posts.update({
          where: { post_id: InvalidIdError.convertToBigInt(req.body.post) },
          data: {
            like_count: { increment: 1 },
            post_likes: {},
          },
        }),
        prisma.post_likes.create({
          data: {
            like_id: generator.nextId(),
            post_id: postId,
            user_id: req.userId!,
            timestamp: new Date().toISOString(),
          },
        }),
      ]);
      return res.status(200).json({ success: true });
    } else {
      // If the user has already liked the post, return an error
      throw new ClientError("User has already liked the post.");
    }
  })
);

// Define a route for unliking a post
router.post(
  "/unlike",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Check if the user has already liked the post
    const postId = InvalidIdError.convertToBigInt(req.body.post);
    const postLike = await prisma.post_likes.findFirst({
      where: {
        post_id: postId,
        user_id: req.userId,
      },
    });
    if (postLike) {
      //TODO handle update fails and likes not.
      // Begin a database transaction
      await TransactionHandler.createTransactionArray(prisma, [
        // Decrement the like count of the post and delete the like record
        prisma.posts.update({
          where: { post_id: postId },
          data: {
            like_count: { decrement: 1 },
            post_likes: {},
          },
        }),

        prisma.post_likes.delete({
          where: {
            like_id: postLike.like_id,
          },
        }),
      ]);
      return res.status(200).json({ success: true });
    } else {
      // If the user hasn't liked the post, return an error
      throw new ClientError(
        "Post Isn't liked. Cannot remove a like that does not exist."
      );
    }
  })
);

router.post(
  "/save",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    await prisma.saved_posts.create({
      data: {
        saved_post_id: generator.nextId(),
        post_id: req.body.post,
        user_id: req.userId!,
        timestamp: new Date().toISOString(),
      },
    });
    return res.status(201).json({ success: true });
  })
);

// Route for removing a post from a user's saved_posts array
router.post(
  "/unsave",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const postLikeNew = await prisma.saved_posts.deleteMany({
      where: {
        post_id: req.body.post,
        user_id: req.userId,
      },
    });
    return res.status(200).json({ success: true });
  })
);

// This route is used to retrieve a page of saved posts
router.get(
  "/saved",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Find the post with the provided ID from the request header
    const posts = await prisma.saved_posts.findMany({
      where: { user_id: req.userId },
      include: { posts: true },
    });
    if (posts) {
      // Return the array of comments as a response
      return res.status(200).json(posts);
    } else {
      return res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  })
);

// Define a route to create a new comment
router.post(
  "/comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Create a new comment using Prisma
    const comment = await prisma.comments.create({
      data: {
        comment_id: generator.nextId(), // Generate a unique comment ID
        post_id: InvalidIdError.convertToBigInt(req.body.post), // Extract the post ID from the request
        sender_id: req.userId!, // Set the sender's user ID
        content: req.body.content, // Extract the comment content from the request
        timestamp: new Date().toISOString(), // Set the current timestamp
        like_count: 0, // Initialize the like count to 0
        dislike_count: 0,
      },
    });

    // Send the created comment as a JSON response
    res.json(comment);
  })
);

// Define a route to delete a comment
router.delete(
  "/comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Delete a comment by its comment_id
    const comment = await prisma.comments.delete({
      where: {
        comment_id: InvalidIdError.convertToBigInt(req.body.comment), // Extract the comment ID from the request
      },
    });

    // Send a success message as a JSON response
    res.status(200).json({ success: true });
  })
);

// Define a route to like a comment
router.post(
  "/like_comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Extract the user ID from the request
    CheckNulls.checkNullUser(req.userId);
    const commentId = InvalidIdError.convertToBigInt(req.body.comment);

    // Check if the user has already liked the comment
    const commentLike = await prisma.comment_likes.findFirst({
      where: {
        comment_id: commentId,
        user_id: req.userId,
      },
    });

    if (!commentLike) {
      // Update the comment's like count and create a new comment_like entry
      await prisma.comments.update({
        where: {
          comment_id: commentId,
        },
        data: {
          like_count: { increment: 1 }, // Increment the like count by 1
          comment_likes: {
            create: {
              like_id: generator.nextId(), // Generate a unique like ID
              user_id: req.userId!, // Set the user ID
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      // Send a success message as a JSON response
      return res.status(200).json({ success: true });
    } else {
      // Send an error message if the comment is already liked
      return res.json({ error: "Comment already liked" });
    }
  })
);

// Define a route to unlike a comment
router.post(
  "/unlike_comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Check if the user has already liked the comment
    const commentLike = await prisma.comment_likes.findFirst({
      where: {
        comment_id: InvalidIdError.convertToBigInt(req.body.comment),
        user_id: req.userId,
      },
    });

    if (commentLike) {
      // Update the comment's like count and delete the comment_like entry
      await prisma.comments.update({
        where: {
          comment_id: InvalidIdError.convertToBigInt(req.body.comment),
        },
        data: {
          like_count: { decrement: 1 }, // Decrement the like count by 1
          comment_likes: { delete: { like_id: commentLike.like_id } }, // Delete the like.
        },
      });

      // Send a success message as a JSON response
      return res.status(200).json({ success: true });
    } else {
      // Send an error message if the comment is not liked
      throw new ClientError(
        "Comment isn't liked.  Can't remove a like that doesn't exist. "
      );
    }
  })
);

// Define a route to like a comment
// TODO Add a check for like and remove like if there is
router.post(
  "/dislike_comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Check if the user has already liked the comment
    const commentDislike = await prisma.comment_dislikes.findFirst({
      where: {
        comment_id: InvalidIdError.convertToBigInt(req.body.comment),
        user_id: req.userId,
      },
    });

    if (!commentDislike) {
      // Use a transaction to update the comment's like count and create a new comment_like entry
      const commentId = InvalidIdError.convertToBigInt(req.body.comment);
      const comment = await prisma.comments.update({
        where: {
          comment_id: commentId,
        },
        data: {
          dislike_count: { increment: 1 }, // Increment the like count by 1
          comment_dislikes: {
            create: {
              dislike_id: generator.nextId(), // Generate a unique dislike ID
              user_id: req.userId!, // Set the user ID
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      // Send a success message as a JSON response
      return res.status(200).json({ success: true });
    } else {
      // Send an error message if the comment is already liked
      throw new ClientError("Comment already disliked. ");
    }
  })
);

// Define a route to undislike a comment
router.post(
  "/undislike_comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const commentId = InvalidIdError.convertToBigInt(req.body.comment);
    // Check if the user has already liked the comment
    const commentDislike = await prisma.comment_dislikes.findFirst({
      where: {
        comment_id: commentId,
        user_id: req.userId,
      },
    });

    if (commentDislike) {
      // Use a transaction to update the comment's like count and delete the comment_like entry
      const comment = await prisma.comments.update({
        where: {
          comment_id: InvalidIdError.convertToBigInt(req.body.comment),
        },
        data: {
          like_count: { decrement: 1 }, // Decrement the like count by 1
          comment_dislikes: {
            delete: {
              // Delete the dislike entry
              dislike_id: commentDislike.dislike_id,
            },
          },
        },
      });

      // Send a success message as a JSON response
      return res.status(200).json({ success: true });
    } else {
      // Send an error message if the comment is not liked
      throw new ClientError("Comment isn't disliked so cannot remove.");
    }
  })
);

// This route is used to retrieve a single comment by its ID
router.get(
  "/comment",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    // Find the comment with the provided ID from the request header
    const comment = prisma.comments.findFirst({
      where: {
        comment_id: InvalidIdError.convertToBigInt(req.headers.comment),
      },
      include: { comment_likes: { where: { user_id: req.userId } } },
    });

    // Return the comment object as a response
    res.json(comment);
  })
);

// This route is used to retrieve a page of comments for a single post
router.get(
  "/comments",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    // Find the post with the provided ID from the request header
    const comments = await prisma.posts.findFirst({
      where: {
        post_id: InvalidIdError.convertToBigInt(req.headers.post),
        NOT: {},
      },
      include: {
        comments: {
          take: 20,
          skip: 20 * page,
          where: {
            NOT: {
              OR: [
                // Exclude comments by users blocked by the current user
                {
                  sender_id: {
                    in: (
                      await prisma.blocked_users.findMany({
                        where: { blocking_user_id: req.userId },
                        select: { blocked_user_id: true },
                      })
                    ).map((b) => b.blocked_user_id),
                  },
                },
                // Exclude comments by users who have blocked the current user
                {
                  sender_id: {
                    in: (
                      await prisma.blocked_users.findMany({
                        where: { blocked_user_id: req.userId },
                        select: { blocking_user_id: true },
                      })
                    ).map((b) => b.blocking_user_id),
                  },
                },
              ],
            },
          },
          include: {
            comment_likes: {
              where: {
                user_id: req.userId,
              },
            },
          },
        },
      },
    });

    if (comments) {
      // Return the array of comments as a response
      return res.status(200).json(comments.comments);
    } else {
      return res.status(400).json({ ec: ErrorCode.RecordNotFound });
    }
  })
);
// Route for removing a post
router.delete(
  "/post",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const post = await prisma.posts.delete({
      where: {
        post_id: InvalidIdError.convertToBigInt(req.body.post),
        author_id: req.userId,
      },
    });

    res.status(200).json({ success: true }); // Send a JSON response to the client indicating success
  })
);

// This route is used to retrieve a page of posts
router.post(
  "/posts",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    //! NEEDS TESTING
    //let seen = JSON.parse(req.body.seen);
    const take = 20;
    const skip = 20 * parseInt(req.body.page);
    let remaining = 20;
    let finalPosts: postsE[] = [];
    // Find the user with the provided ID
    finalPosts = (await prisma.$queryRaw`
        SELECT
            p.post_id,
            p.author_id,
            p.description,
            p.image,
            p.like_count AS total_likes,
            p.friends_only,
            p."location"::text,
            p.timestamp,
            COUNT(c.comment_id) AS comment_count,
            COUNT(pl.like_id) AS total_likes,
            CASE WHEN sp.post_id IS NOT NULL THEN true ELSE false END AS saved
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.post_id
        LEFT JOIN post_likes pl ON pl.post_id = p.post_id
        LEFT JOIN saved_posts sp ON sp.post_id = p.post_id AND sp.user_id = ${req.userId}
        WHERE p.author_id IN (
                -- Combined query for following, followers, and friends
                SELECT following_user_id FROM following WHERE user_id = ${req.userId}
                UNION
                SELECT user_id FROM followers WHERE follower_user_id = ${req.userId}
                UNION
                SELECT CASE WHEN user1_id = ${req.userId} THEN user2_id ELSE user1_id END 
                FROM friends WHERE ${req.userId} IN (user1_id, user2_id)
            )
        -- Ensure the user has not liked the post
        AND NOT EXISTS (
            SELECT 1 FROM post_likes pl WHERE pl.user_id = ${req.userId} AND pl.post_id = p.post_id
        )
        -- Ensure the user has not blocked the author
        AND p.author_id NOT IN (
            SELECT blocked_user_id FROM blocked_users WHERE blocking_user_id = ${req.userId}
        )
        -- Ensure the author has not blocked the user
        AND ${req.userId} NOT IN (
            SELECT blocked_user_id FROM blocked_users WHERE blocking_user_id = p.author_id
        )
        GROUP BY p.post_id, p.author_id, p.description, p.image, p.like_count, p.friends_only, p."location", sp.saved_post_id
        LIMIT ${remaining} OFFSET ${skip};
      `) as postsE[];

    // If there are still not enough posts, find posts from a random friend of a friend (if they are not private)
    let finalPostIds = [];
    if (finalPosts.length < 20) {
      for (const p of finalPosts) {
        finalPostIds.push(p.post_id);
      }
      remaining = remaining - finalPosts.length;
      //TODO fix offset
      const extraPosts = (await prisma.$queryRaw`
            WITH user_friends AS (
                SELECT DISTINCT f.user1_id AS friend_id
                FROM friends f
                WHERE (f.user2_id = ${req.userId} OR f.user1_id = ${req.userId})
                UNION
                SELECT DISTINCT f.user2_id AS friend_id
                FROM friends f
                WHERE (f.user1_id = ${req.userId} OR f.user2_id = ${req.userId})
            ),
            post_data AS (
                SELECT
                    p.post_id,
                    p.author_id,
                    p.description,
                    p.image,
                    p.like_count,
                    p.friends_only,
                    p."location"::text,
                    p.timestamp,
                    (
                        SELECT COUNT(c.comment_id)
                        FROM comments c
                        WHERE c.post_id = p.post_id
                    ) AS comment_count,
                    (
                        SELECT COUNT(pl.like_id)
                        FROM post_likes pl
                        WHERE pl.post_id = p.post_id
                    ) AS total_likes
                FROM posts p
                WHERE p.author_id IN (SELECT friend_id FROM user_friends WHERE friend_id <> ${
                  req.userId
                })
                ${
                  finalPostIds.length > 0
                    ? Prisma.sql`
                  AND p.post_id NOT IN (SELECT * FROM UNNEST(ARRAY[${Prisma.join(
                    finalPostIds.map((id) => InvalidIdError.convertToBigInt(id))
                  )}]::bigint[]))
                  `
                    : Prisma.sql``
                }
                    AND NOT EXISTS (
                        SELECT 1
                        FROM post_likes pl
                        WHERE pl.user_id = ${req.userId}
                        AND pl.post_id = p.post_id
                    )
                    AND ${req.userId} NOT IN (
                      SELECT blocked_user_id FROM blocked_users WHERE blocking_user_id = p.author_id
                    )
                    AND p.author_id NOT IN (
                      SELECT blocked_user_id FROM blocked_users WHERE blocking_user_id = ${
                        req.userId
                      }
                    )
            )
            SELECT
                pd.post_id,
                pd.author_id,
                pd.description,
                pd.image,
                pd.like_count,
                pd.friends_only,
                pd."location",
                pd.timestamp,
                pd.comment_count,
                pd.like_count AS total_likes,
                CASE WHEN sp.saved_post_id IS NOT NULL THEN true ELSE false END AS saved
            FROM post_data pd
            LEFT JOIN saved_posts sp ON pd.post_id = sp.post_id AND sp.user_id = ${
              req.userId
            }
            LIMIT ${remaining} OFFSET ${skip};
          `) as postsE[];
      finalPosts = [...finalPosts, ...extraPosts];
      remaining -= extraPosts.length;
      for (const p of extraPosts) {
        finalPostIds.push(p.post_id);
      }
    }
    if (finalPosts.length < 20) {
      //TODO NEEDS FURTHER TESTING
      getInfluencers();
      const blockedUsers = await prisma.blocked_users.findMany({
        where: {
          OR: [
            { blocking_user_id: req.userId }, // Users blocked by the querying user
            { blocked_user_id: req.userId }, // Users who blocked the querying user
          ],
        },
        select: {
          blocking_user_id: true,
          blocked_user_id: true,
        },
      });

      // Extract unique user IDs
      const blockedUserIds = new Set(
        blockedUsers.flatMap((blocked) => [
          blocked.blocking_user_id,
          blocked.blocked_user_id,
        ])
      );

      const influencerPosts = await prisma.posts.findMany({
        where: {
          author_id: {
            in: influencers,
            notIn: Array.from(blockedUserIds), // Convert Set back to an array
          },
          post_id: { notIn: finalPostIds },
        },
        select: {
          post_id: true,
          author_id: true,
          description: true,
          image: true,
          like_count: true,
          friends_only: true,
          timestamp: true,
          post_likes: {
            select: {
              user_id: true,
            },
            where: {
              user_id: req.userId,
            },
          },
          _count: {
            select: {
              post_likes: true,
              comments: true,
            },
          },
          saved_posts: {
            select: {
              saved_post_id: true,
            },
            where: {
              user_id: req.userId,
              post_id: { in: finalPostIds },
            },
          },
        },
        take: remaining,
        skip: skip,
      });

      let influencerPostsFormatted: postsE[] = [];

      for (const post of influencerPosts) {
        influencerPostsFormatted.push({
          post_id: post.post_id,
          author_id: post.author_id,
          description: post.description,
          image: post.image,
          like_count: post.like_count,
          friends_only: post.friends_only,
          location: "",
          liked: post.post_likes.length > 0,
          total_likes: BigInt(post._count.post_likes),
          comment_count: BigInt(post._count.comments),
          influencer: true,
          timestamp: post.timestamp,
          saved: post.saved_posts.length > 0 ? true : false,
        });
      }
      finalPosts = [...finalPosts, ...influencerPostsFormatted];
      remaining -= influencerPostsFormatted.length;
    }
    if (finalPosts.length < 20) {
      const userLikedPosts = await prisma.post_likes.findMany({
        where: {
          user_id: req.userId, // Replace 'req.userId' with the actual user's ID
          posts: {
            author_id: {
              notIn: (
                await prisma.blocked_users.findMany({
                  where: {
                    OR: [
                      { blocking_user_id: req.userId }, // Users the target user has blocked
                      { blocked_user_id: req.userId }, // Users who have blocked the target user
                    ],
                  },
                  select: { blocked_user_id: true, blocking_user_id: true },
                })
              ).map(
                (blocked) => blocked.blocked_user_id || blocked.blocking_user_id
              ),
            },
          },
        },
        include: {
          posts: {
            include: {
              _count: {
                select: {
                  post_likes: true,
                  comments: true,
                },
              },
              saved_posts: {
                where: {
                  user_id: req.userId, // Replace 'req.userId' with the actual user's ID
                },
              },
            },
          },
        },
        skip: skip, // Calculate how many records to skip
        take: remaining, // Set the number of records to retrieve
      });

      console.log(userLikedPosts);

      let userLikedPostsFormatted: postsE[] = [];

      for (const post of userLikedPosts) {
        userLikedPostsFormatted.push({
          post_id: post.posts.post_id,
          author_id: post.posts.author_id,
          description: post.posts.description,
          image: post.posts.image,
          like_count: post.posts.like_count,
          friends_only: post.posts.friends_only,
          location: "",
          liked: true,
          total_likes: BigInt(
            post.posts._count.post_likes
          ),
          comment_count: BigInt(
            post.posts._count.comments
          ),
          timestamp: post.timestamp,
          saved: post.posts.saved_posts.length > 0 ? true : false,
        });
      }
      finalPosts = [...finalPosts, ...userLikedPostsFormatted];
    }
    let returnPosts: postsE[] = [];
    for (const post of finalPosts) {
      let e = post;
      e.liked = Boolean(post.liked);
      returnPosts.push(e);
    }
    return res.json(returnPosts);
  })
);

// This is a route handler for GET requests to "/user_posts"
router.get(
  "/user_posts",
  ...RouteBuilder.createRouteHandler(async (req, res) => {
    const page = CheckNulls.checkNullPage(req.headers.page);

    const targetUser = await prisma.users.findFirst({
      where: { user_id: InvalidIdError.convertToBigInt(req.headers.user, req.userId) },
      include: HandleBlocks.getIncludeBlockInfo(req.userId!),
    });

    // Check if the target user was found.  If not then throw an error to reflect that.
    UserNotFoundError.throwIfNull(
      targetUser,
      UserNotFoundError.targetUserMessage
    );

    // Check if the user is blocked or the other way round
    UserBlockedError.throwIfBlocked(HandleBlocks.checkIsBlocked(targetUser));

    // Query the database for posts authored by the current user, sorted by date in descending order
    // The "skip" and "limit" options are used for pagination
    const posts = await prisma.posts.findMany({
      where: { author_id: InvalidIdError.convertToBigInt(req.headers.user, req.userId) },
      orderBy: { timestamp: Prisma.SortOrder.desc },
      skip: 20 * page,
      take: 20,
    });
    let postsFormatted = [];
    for (const post of posts) {
      postsFormatted.push({
        post_id: post.post_id,
        author_id: post.author_id,
        description: post.description,
        image: post.image,
        friends_only: post.friends_only,
        location: "",
        timestamp: post.timestamp,
      });
    }

    // Send the posts data as a JSON response
    res.json(posts);
  })
);

export default router;
