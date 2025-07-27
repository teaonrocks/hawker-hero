const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");

// GET - Recommendations page with filtering
router.get("/recommendations", async (req, res) => {
	// Get filter values from the query string
	const { search, stall, user } = req.query;
	const filters = {
		search: search || "",
		stall: stall || "",
		user: user || "",
	};

	// Base SQL query
	let sql = `
    SELECT r.*, u.username, s.name as stall_name,
           fi.name as food_name, hc.name as center_name
    FROM recommendations r
    JOIN users u ON r.user_id = u.id
    JOIN stalls s ON r.stall_id = s.id
    LEFT JOIN food_items fi ON r.food_id = fi.id
    LEFT JOIN hawker_centers hc ON s.center_id = hc.id
  `;

	// Dynamically build WHERE clause to prevent SQL injection
	const whereClauses = [];
	const params = [];

	if (search) {
		whereClauses.push("(r.tip LIKE ? OR s.name LIKE ? OR u.username LIKE ?)");
		params.push(`%${search}%`, `%${search}%`, `%${search}%`);
	}
	if (stall) {
		whereClauses.push("r.stall_id = ?");
		params.push(stall);
	}
	if (user) {
		whereClauses.push("r.user_id = ?");
		params.push(user);
	}

	if (whereClauses.length > 0) {
		sql += ` WHERE ${whereClauses.join(" AND ")}`;
	}

	sql += " ORDER BY r.created_at DESC LIMIT 50";

	try {
		// Fetch all necessary data concurrently
		const [recommendations, stalls, foodItems, recommendationUsers] =
			await Promise.all([
				queryDB(sql, params), // Use the dynamically built query
				queryDB(`
        SELECT s.id, s.name, hc.name as center_name
        FROM stalls s
        LEFT JOIN hawker_centers hc ON s.center_id = hc.id
        ORDER BY s.name ASC
      `),
				queryDB(`
        SELECT fi.id, fi.name, s.name as stall_name
        FROM food_items fi
        JOIN stalls s ON fi.stall_id = s.id
        ORDER BY fi.name ASC
      `),
				// Get only users who have made recommendations for the filter dropdown
				queryDB(`
        SELECT DISTINCT u.id, u.username
        FROM recommendations r
        JOIN users u ON r.user_id = u.id
        ORDER BY u.username ASC
      `),
			]);

		res.render("recommendations", {
			title: "Recommendations - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			recommendations: recommendations,
			stalls: stalls,
			foodItems: foodItems,
			recommendationUsers: recommendationUsers, // Pass users for the dropdown
			filters: filters, // Pass current filters back to the view
		});
	} catch (err) {
		console.error("Database error fetching recommendations page data:", err);
		req.flash("error", "Failed to load recommendations and related data.");
		res.render("recommendations", {
			title: "Recommendations - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			recommendations: [],
			stalls: [],
			foodItems: [],
			recommendationUsers: [],
			filters: filters,
		});
	}
});

// POST - Add new recommendation (Admin Only)
router.post(
	"/recommendations/add",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { stall_id, food_id, tip } = req.body;
		const user_id = req.session.user.id; // Admin's user ID

		if (!stall_id || !tip) {
			req.flash("error", "Stall and Tip are required to add a recommendation.");
			return res.redirect("/recommendations");
		}

		try {
			const insertSql =
				"INSERT INTO recommendations (user_id, stall_id, food_id, tip, created_at) VALUES (?, ?, ?, ?, NOW())";
			// Convert food_id to null if it's an empty string
			const actualFoodId = food_id === "" ? null : food_id;
			await queryDB(insertSql, [user_id, stall_id, actualFoodId, tip]);

			req.flash("success", "Recommendation added successfully!");
			res.redirect("/recommendations");
		} catch (err) {
			console.error("Database error adding recommendation:", err);
			req.flash("error", "Failed to add recommendation. Please try again.");
			res.redirect("/recommendations");
		}
	}
);

// POST - Update recommendation (Admin Only)
router.post(
	"/recommendations/edit/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;
		const { stall_id, food_id, tip } = req.body;

		if (!stall_id || !tip) {
			req.flash(
				"error",
				"Stall and Tip are required to update a recommendation."
			);
			return res.redirect("/recommendations");
		}

		try {
			const updateSql =
				"UPDATE recommendations SET stall_id = ?, food_id = ?, tip = ? WHERE id = ?";
			const actualFoodId = food_id === "" ? null : food_id;
			await queryDB(updateSql, [stall_id, actualFoodId, tip, id]);

			req.flash("success", `Recommendation ID ${id} updated successfully!`);
			res.redirect("/recommendations");
		} catch (err) {
			console.error("Database error updating recommendation:", err);
			req.flash("error", "Failed to update recommendation. Please try again.");
			res.redirect("/recommendations");
		}
	}
);

// POST - Delete recommendation (Admin Only)
router.post(
	"/recommendations/delete/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;

		try {
			const deleteSql = "DELETE FROM recommendations WHERE id = ?";
			await queryDB(deleteSql, [id]);

			req.flash("success", `Recommendation ID ${id} deleted successfully!`);
			res.redirect("/recommendations");
		} catch (err) {
			console.error("Database error deleting recommendation:", err);
			req.flash("error", "Failed to delete recommendation. Please try again.");
			res.redirect("/recommendations");
		}
	}
);

module.exports = router;
