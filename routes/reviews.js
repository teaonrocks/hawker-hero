const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");

// Main reviews page with filtering
router.get("/reviews", (req, res) => {
	const { rating, stall, sort, search, min_price, max_price } = req.query;

	console.log("Received filters:", {
		rating,
		stall,
		sort,
		search,
		min_price,
		max_price,
	});

	let sql = `
    SELECT r.*, u.username, s.name AS stall_name, s.location, s.image_url
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN stalls s ON r.stall_id = s.id
    WHERE 1 = 1
  `;

	const params = [];

	if (rating) {
		sql += " AND r.rating = ?";
		params.push(parseInt(rating));
	}

	if (stall) {
		sql += " AND s.name = ?";
		params.push(stall);
	}

	if (search) {
		sql += ` AND s.name LIKE ?`;
		params.push(`%${search}%`);
	}

	if (min_price || max_price) {
		sql += ` AND EXISTS (
      SELECT 1 FROM food_items f
      WHERE f.stall_id = s.id`;

		if (min_price) {
			sql += ` AND f.price >= ?`;
			params.push(parseFloat(min_price));
		}

		if (max_price) {
			sql += ` AND f.price <= ?`;
			params.push(parseFloat(max_price));
		}

		sql += `)`;
	}

	if (sort === "recent") {
		sql += " ORDER BY r.created_at DESC";
	} else if (sort === "oldest") {
		sql += " ORDER BY r.created_at ASC";
	} else if (sort === "highest") {
		sql += " ORDER BY r.rating DESC";
	} else if (sort === "lowest") {
		sql += " ORDER BY r.rating ASC";
	} else {
		sql += " ORDER BY r.created_at DESC";
	}

	const reviewQuery = new Promise((resolve, reject) => {
		db.query(sql, params, (err, results) => {
			if (err) return reject(err);
			resolve(results);
		});
	});

	const stallQuery = new Promise((resolve, reject) => {
		db.query("SELECT DISTINCT name FROM stalls", (err, results) => {
			if (err) return reject(err);
			resolve(results);
		});
	});

	const commentQuery = new Promise((resolve, reject) => {
		db.query(
			`
      SELECT c.*, u.username 
      FROM comments c
      JOIN users u ON c.user_id = u.id
    `,
			(err, results) => {
				if (err) return reject(err);
				resolve(results);
			}
		);
	});

	Promise.all([reviewQuery, stallQuery, commentQuery])
		.then(([reviews, stallOptions, allComments]) => {
			// Calculate average rating
			let averageRating = 0;
			if (reviews.length > 0) {
				const total = reviews.reduce((sum, r) => sum + r.rating, 0);
				averageRating = total / reviews.length;
			}

			// Group comments by review ID
			const commentsByReview = {};
			allComments.forEach((comment) => {
				if (!commentsByReview[comment.review_id]) {
					commentsByReview[comment.review_id] = [];
				}
				commentsByReview[comment.review_id].push(comment);
			});

			res.render("reviews", {
				title: "Reviews - Hawker Hero",
				user: req.session.user,
				messages: req.flash("success").concat(req.flash("error")),
				reviews,
				stalls: stallOptions,
				rating,
				stall,
				sort,
				search,
				min_price,
				max_price,
				averageRating,
				commentsByReview,
			});
		})
		.catch((err) => {
			console.error("Error loading reviews page:", err);
			res.status(500).send("Server error");
		});
});

// GET - Show add review form (Admin only)
router.get("/addReviews", checkAuthenticated, (req, res) => {
	if (req.session.user.role !== "admin") {
		req.flash("error", "User not authorized");
		return res.redirect("/reviews");
	}

	const sql = "SELECT id, name FROM stalls";

	db.query(sql, (err, stalls) => {
		if (err) {
			console.error("Error fetching stalls:", err);
			req.flash("error", "Unable to load stalls. Please try again.");
			return res.redirect("/reviews");
		}

		res.render("addReviews", {
			title: "Add Review - Hawker Hero",
			user: req.session.user,
			stalls,
			formData: req.flash("formData")[0] || {},
			error_stall: req.flash("error_stall")[0] || null,
			error_rating: req.flash("error_rating")[0] || null,
			error_comment: req.flash("error_comment")[0] || null,
			messages: req.flash("success").concat(req.flash("error")),
		});
	});
});

// POST - Submit review (Admin only)
router.post("/addReviews", checkAuthenticated, (req, res) => {
	if (req.session.user.role !== "admin") {
		req.flash("error", "User not authorized");
		return res.redirect("/reviews");
	}

	const { stall_id, rating, comment } = req.body;

	// Field validation
	let hasError = false;

	if (!stall_id) {
		req.flash("error_stall", "Please select a stall.");
		hasError = true;
	}
	if (!rating || rating < 1 || rating > 5) {
		req.flash("error_rating", "Rating must be between 1 and 5.");
		hasError = true;
	}
	if (!comment || comment.trim() === "") {
		req.flash("error_comment", "Comment cannot be empty.");
		hasError = true;
	}

	if (hasError) {
		req.flash("formData", req.body);
		return res.redirect("/addReviews");
	}

	const sql = `
    INSERT INTO reviews (user_id, stall_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;

	db.query(
		sql,
		[req.session.user.id, stall_id, rating, comment],
		(err, result) => {
			if (err) {
				console.error("Error inserting review:", err);
				req.flash("error", "Could not submit review. Try again.");
				req.flash("formData", req.body);
				return res.redirect("/addReviews");
			}

			req.flash("success", "Review submitted successfully!");
			res.redirect("/reviews");
		}
	);
});

// GET - Edit review form
router.get("/editReviews/:id", checkAuthenticated, (req, res) => {
	const reviewId = req.params.id;
	const isAdmin = req.session.user.role === "admin";
	const userId = req.session.user.id;

	const sql = isAdmin
		? "SELECT * FROM reviews WHERE id = ?"
		: "SELECT * FROM reviews WHERE id = ? AND user_id = ?";

	const params = isAdmin ? [reviewId] : [reviewId, userId];

	db.query(sql, params, (err, results) => {
		if (err || results.length === 0) {
			req.flash("error", "Review not found or you're not authorized.");
			return res.redirect("/reviews");
		}

		db.query("SELECT id, name FROM stalls", (err2, stalls) => {
			if (err2) {
				console.error("Error fetching stalls:", err2);
				req.flash("error", "Could not load stall options.");
				return res.redirect("/reviews");
			}

			res.render("editReviews", {
				title: "Edit Review",
				user: req.session.user,
				messages: req.flash("error"),
				formData: results[0],
				stalls: stalls,
			});
		});
	});
});

// POST - Edit review
router.post("/editReviews/:id", checkAuthenticated, (req, res) => {
	const reviewId = req.params.id;
	const { stall_id, rating, comment } = req.body;
	const isAdmin = req.session.user.role === "admin";
	const userId = req.session.user.id;

	if (!stall_id || !rating || !comment) {
		req.flash("error", "All fields are required.");
		return res.redirect(`/editReviews/${reviewId}`);
	}

	const sql = isAdmin
		? "UPDATE reviews SET stall_id = ?, rating = ?, comment = ? WHERE id = ?"
		: "UPDATE reviews SET stall_id = ?, rating = ?, comment = ? WHERE id = ? AND user_id = ?";

	const params = isAdmin
		? [stall_id, rating, comment, reviewId]
		: [stall_id, rating, comment, reviewId, userId];

	db.query(sql, params, (err, result) => {
		if (err || result.affectedRows === 0) {
			console.error("Error updating review:", err);
			req.flash("error", "Could not update review or unauthorized.");
			return res.redirect(`/editReviews/${reviewId}`);
		}

		req.flash("success", "Review updated successfully!");
		res.redirect("/reviews");
	});
});

// GET - Delete review by ID
router.get("/reviews/delete/:id", checkAuthenticated, (req, res) => {
	const reviewId = req.params.id;
	const user = req.session.user;

	if (!user) {
		req.flash("error", "Unauthorized access.");
		return res.redirect("/reviews");
	}

	// First, verify the review belongs to this user or user is admin
	const checkSql = `SELECT * FROM reviews WHERE id = ? LIMIT 1`;

	db.query(checkSql, [reviewId], (err, results) => {
		if (err || results.length === 0) {
			console.error("Review not found or error:", err);
			req.flash("error", "Review not found.");
			return res.redirect("/reviews");
		}

		const review = results[0];

		// Only allow owner or admin to delete
		if (user.role !== "admin" && user.id !== review.user_id) {
			req.flash("error", "You are not authorized to delete this review.");
			return res.redirect("/reviews");
		}

		// Proceed to delete
		const deleteSql = `DELETE FROM reviews WHERE id = ?`;
		db.query(deleteSql, [reviewId], (deleteErr) => {
			if (deleteErr) {
				console.error("Error deleting review:", deleteErr);
				req.flash("error", "Failed to delete review.");
			} else {
				req.flash("success", "Review deleted successfully.");
			}
			res.redirect("/reviews");
		});
	});
});

// POST - Add comment to review
router.post("/reviews/:id/comments", (req, res) => {
	if (!req.session.user) return res.redirect("/login");

	const review_id = req.params.id;
	const user_id = req.session.user.id;
	const comment = req.body.comment;

	const sql =
		"INSERT INTO comments (review_id, user_id, comment) VALUES (?, ?, ?)";
	db.query(sql, [review_id, user_id, comment], (err) => {
		if (err) {
			console.error(err);
			req.flash("error", "Failed to post comment.");
		} else {
			req.flash("success", "Comment posted.");
		}
		res.redirect("/reviews");
	});
});

// GET - Delete comment
router.get("/comments/delete/:id", checkAuthenticated, (req, res) => {
	const commentId = req.params.id;
	const user = req.session.user;

	if (!user) {
		req.flash("error", "Unauthorized");
		return res.redirect("/reviews");
	}

	// Verify ownership or admin
	const sql = "SELECT * FROM comments WHERE id = ?";
	db.query(sql, [commentId], (err, results) => {
		if (err || results.length === 0) {
			req.flash("error", "Comment not found");
			return res.redirect("/reviews");
		}
		const comment = results[0];
		if (comment.user_id !== user.id && user.role !== "admin") {
			req.flash("error", "You are not authorized to delete this comment");
			return res.redirect("/reviews");
		}

		// Delete the comment
		const deleteSql = "DELETE FROM comments WHERE id = ?";
		db.query(deleteSql, [commentId], (err) => {
			if (err) {
				req.flash("error", "Failed to delete comment");
			} else {
				req.flash("success", "Comment deleted");
			}
			res.redirect("/reviews");
		});
	});
});

// GET - Edit comment form
router.get("/comments/edit/:id", checkAuthenticated, (req, res) => {
	const commentId = req.params.id;
	const user = req.session.user;

	const sql = "SELECT * FROM comments WHERE id = ?";
	db.query(sql, [commentId], (err, results) => {
		if (err || results.length === 0) {
			req.flash("error", "Comment not found");
			return res.redirect("/reviews");
		}
		const comment = results[0];
		if (comment.user_id !== user.id && user.role !== "admin") {
			req.flash("error", "You are not authorized to edit this comment");
			return res.redirect("/reviews");
		}

		res.render("editComment", {
			title: "Edit Comment",
			user,
			formData: comment,
			messages: req.flash("success").concat(req.flash("error")),
		});
	});
});

// POST - Update comment
router.post("/comments/edit/:id", checkAuthenticated, (req, res) => {
	const commentId = req.params.id;
	const user = req.session.user;
	const { comment } = req.body;

	if (!comment || comment.trim() === "") {
		req.flash("error", "Comment cannot be empty");
		return res.redirect(`/comments/edit/${commentId}`);
	}

	const sql = "SELECT * FROM comments WHERE id = ?";
	db.query(sql, [commentId], (err, results) => {
		if (err || results.length === 0) {
			req.flash("error", "Comment not found");
			return res.redirect("/reviews");
		}
		const existingComment = results[0];
		if (existingComment.user_id !== user.id && user.role !== "admin") {
			req.flash("error", "You are not authorized to edit this comment");
			return res.redirect("/reviews");
		}

		const updateSql = "UPDATE comments SET comment = ? WHERE id = ?";
		db.query(updateSql, [comment, commentId], (err) => {
			if (err) {
				req.flash("error", "Failed to update comment");
			} else {
				req.flash("success", "Comment updated successfully");
			}
			res.redirect("/reviews");
		});
	});
});

module.exports = router;
