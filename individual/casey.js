app.get("/reviews", (req, res) => {
	const { rating, stall, sort } = req.query;

	let sql = `
		SELECT r.*, u.username, s.name AS stall_name, s.location
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

	Promise.all([reviewQuery, stallQuery])
		.then(([reviews, stalls]) => {
			res.render("reviews", {
				title: "Reviews - Hawker Hero",
				user: req.session.user,
				messages: req.flash("success"),
				reviews,
				stalls, // pass stall names
				rating,
				stall,
				sort
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).send("Server error");
		});
});


// GET - Show add review form
app.get("/addReviews", checkAuthenticated, (req, res) => {
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
			messages: req.flash("success").concat(req.flash("error")), // 👈 ADD THIS LINE
		});
	});
});

// POST - Submit review
app.post("/addReviews", checkAuthenticated, (req, res) => {
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
app.get("/editReviews/:id", checkAuthenticated, (req, res) => {
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
				stalls: stalls
			});
		});
	});
});

// POST - Edit review
app.post("/editReviews/:id", checkAuthenticated, (req, res) => {
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
app.get("/reviews/delete/:id", checkAuthenticated, (req, res) => {
	const reviewId = req.params.id;
	const user = req.session.user;

	if (!user) {
		req.flash("error", "Unauthorized access.");
		return res.redirect("/reviews");
	}

	// First, verify the review belongs to this user or user is admin
	const checkSql = `
		SELECT * FROM reviews WHERE id = ? LIMIT 1
	`;

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