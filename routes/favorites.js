const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const {
	checkAuthenticated,
	checkAdmin,
	checkFavoriteOwnershipOrAdmin,
} = require("../middleware/auth");

// List favorites with role-based access control
router.get("/favorites", checkAuthenticated, (req, res) => {
	const { search, view, user: searchUser } = req.query;
	const { id: userId, isAdmin } = req.session.user;
	const showAll = view === "all" && isAdmin;

	let sql = `
        SELECT 
            f.id, f.notes, f.created_at, f.user_id,
            u.username,
            s.id AS stall_id, s.name AS stall_name,
            fd.id AS food_id, fd.name AS food_name
        FROM favorites f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN stalls s ON f.stall_id = s.id
        LEFT JOIN food_items fd ON f.food_id = fd.id
        WHERE 1=1
    `;

	const params = [];

	// Regular users can only see their own favorites
	if (!isAdmin) {
		sql += " AND f.user_id = ?";
		params.push(userId);
	}
	// If admin is viewing a specific user's favorites
	else if (searchUser) {
		sql += " AND f.user_id = ?";
		params.push(searchUser);
	}

	// Search functionality
	if (search) {
		sql += ` AND (
            s.name LIKE ? OR 
            fd.name LIKE ? OR 
            u.username LIKE ? OR 
            f.notes LIKE ?
        )`;
		const searchTerm = `%${search}%`;
		params.push(searchTerm, searchTerm, searchTerm, searchTerm);
	}

	sql += " ORDER BY f.created_at DESC";

	db.query(sql, params, (err, favorites) => {
		if (err) {
			console.error("Error fetching favorites:", err);
			return res.status(500).render("error", {
				title: "Error",
				message: "Failed to load favorites",
				error: { status: 500 },
			});
		}

		// If admin, get list of users with favorites for the user filter
		let users = [];
		if (isAdmin) {
			db.query(
				`
                SELECT DISTINCT u.id, u.username 
                FROM favorites f 
                JOIN users u ON f.user_id = u.id 
                ORDER BY u.username
            `,
				(err, userResults) => {
					if (!err) users = userResults;
					renderFavorites();
				}
			);
		} else {
			renderFavorites();
		}

		function renderFavorites() {
			res.render("favorites", {
				title: isAdmin
					? searchUser
						? `Favorites for User #${searchUser}`
						: "All Favorites"
					: "My Favorites",
				user: req.session.user,
				favorites,
				users,
				search,
				searchUser,
				showAll: isAdmin && !searchUser,
				isAdmin,
				messages: req.flash(),
			});
		}
	});
});

// Add favorite (POST)
router.post("/favorites/add", checkAuthenticated, (req, res) => {
	console.log("Add favorite request body:", req.body); // Debug log

	const { stall_id, food_id, notes, redirect_to } = req.body;
	const user_id = req.session.user.id;
	const redirectPath = redirect_to || "/stalls";

	// Validate that at least one ID is provided
	if ((!stall_id || stall_id === "") && (!food_id || food_id === "")) {
		console.error("Validation failed: No stall_id or food_id provided");
		req.flash(
			"error",
			"Please select either a stall or a food item to favorite"
		);
		return res.redirect(redirectPath);
	}

	// Check if already favorited
	const checkSql = `
        SELECT * FROM favorites 
        WHERE user_id = ? 
        AND ((stall_id = ? AND ? IS NOT NULL AND ? != '') OR (food_id = ? AND ? IS NOT NULL AND ? != ''))`;

	db.query(
		checkSql,
		[user_id, stall_id, stall_id, stall_id, food_id, food_id, food_id],
		(err, results) => {
			if (err) {
				console.error("Error checking for existing favorite:", err);
				req.flash("error", "Error processing your request");
				return res.redirect(redirectPath);
			}

			if (results.length > 0) {
				console.log("Item already in favorites");
				req.flash("info", "This item is already in your favorites");
				return res.redirect(redirectPath);
			}

			// Insert new favorite
			const insertSql = `
            INSERT INTO favorites (user_id, stall_id, food_id, notes, created_at)
            VALUES (?, ?, ?, ?, NOW())`;

			// Convert empty strings to null for database
			const safeStallId = stall_id && stall_id !== "" ? stall_id : null;
			const safeFoodId = food_id && food_id !== "" ? food_id : null;
			const safeNotes = notes && notes.trim() !== "" ? notes.trim() : null;

			db.query(
				insertSql,
				[user_id, safeStallId, safeFoodId, safeNotes],
				(err, result) => {
					if (err) {
						console.error("Error adding favorite:", err);
						req.flash("error", "Failed to add to favorites. Please try again.");
						return res.redirect(redirectPath);
					}

					console.log("Favorite added successfully:", result);
					req.flash("success", "Successfully added to favorites!");
					res.redirect(redirectPath);
				}
			);
		}
	);
});

// Edit favorite form (GET)
router.get(
	"/favorites/edit/:id",
	checkAuthenticated,
	checkFavoriteOwnershipOrAdmin,
	(req, res) => {
		const sql = `
            SELECT f.id, f.notes, f.stall_id, f.food_id, s.name AS stall_name, fd.name AS food_name
            FROM favorites f
            LEFT JOIN stalls s ON f.stall_id = s.id
            LEFT JOIN food_items fd ON f.food_id = fd.id
            WHERE f.id = ?`;

		db.query(sql, [req.params.id], (err, results) => {
			if (err) {
				console.error("Error fetching favorite:", err);
				req.flash("error", "Error loading favorite");
				return res.redirect("/favorites");
			}
			if (!results.length) {
				req.flash("error", "Favorite not found");
				return res.redirect("/favorites");
			}

			res.render("editFavorite", {
				title: "Edit Favorite",
				user: req.session.user,
				favorite: results[0],
				messages: req.flash(),
			});
		});
	}
);

// Update favorite (POST)
router.post(
	"/favorites/update/:id",
	checkAuthenticated,
	checkFavoriteOwnershipOrAdmin,
	(req, res) => {
		const { notes, redirect_to } = req.body;
		const redirectPath = redirect_to || "/favorites";
		const sql = `
            UPDATE favorites 
            SET notes = ?, updated_at = NOW() 
            WHERE id = ?`;

		db.query(sql, [notes || null, req.params.id], (err) => {
			if (err) {
				console.error("Error updating favorite:", err);
				req.flash("error", "Failed to update favorite");
				return res.redirect(redirectPath);
			}
			req.flash("success", "Favorite updated successfully!");
			res.redirect(redirectPath);
		});
	}
);

// Delete favorite (using POST for better browser compatibility)
router.post(
	"/favorites/delete/:id",
	checkAuthenticated,
	checkFavoriteOwnershipOrAdmin,
	(req, res) => {
		const { id } = req.params;
		const redirectTo = req.body.redirect_to || "/favorites";
		const userId = req.session.user.id;
		const isAdmin = req.session.user.isAdmin;

		// First get the favorite to log who deleted it
		db.query("SELECT * FROM favorites WHERE id = ?", [id], (err, results) => {
			if (err) {
				console.error("Error finding favorite to delete:", err);
				req.flash("error", "Error deleting favorite");
				return res.redirect(redirectTo);
			}

			if (!results.length) {
				req.flash("error", "Favorite not found");
				return res.redirect(redirectTo);
			}

			const favorite = results[0];

			// Double-check ownership (belt and suspenders approach)
			if (!isAdmin && favorite.user_id !== userId) {
				req.flash(
					"error",
					"You do not have permission to delete this favorite"
				);
				return res.redirect(redirectTo);
			}

			// Now delete the favorite
			db.query("DELETE FROM favorites WHERE id = ?", [id], (err, result) => {
				if (err) {
					console.error("Error deleting favorite:", err);
					req.flash("error", "Failed to delete favorite");
					return res.redirect(redirectTo);
				}

				if (result.affectedRows === 0) {
					req.flash("warning", "Favorite not found or already deleted");
				} else {
					console.log(
						`Favorite ${id} deleted by user ${userId} (${
							isAdmin ? "admin" : "owner"
						})`
					);
					req.flash("success", "Favorite removed successfully");
				}

				res.redirect(redirectTo);
			});
		});
	}
);

module.exports = router;
