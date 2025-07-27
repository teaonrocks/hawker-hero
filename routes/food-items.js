const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");

router.get("/food-items", async (req, res) => {
	const filters = {
		name: req.query.name || "",
		minPrice: req.query.minPrice || "",
		maxPrice: req.query.maxPrice || "",
	};

	try {
		const foodItems = await queryDB(`
      SELECT fi.id, fi.name, fi.price, fi.description, s.name AS stall_name, s.id AS stall_id
      FROM food_items fi
      JOIN stalls s ON fi.stall_id = s.id
    `);

		const stalls = await queryDB(
			"SELECT id, name FROM stalls ORDER BY name ASC"
		);
		console.log("Stalls fetched:", stalls);
		console.log("filters:", filters);
		res.render("food-items", {
			title: "Food Items - Hawker Hero",
			user: req.session.user, // May be undefined if not logged in
			messages: req.flash("success"),
			errors: req.flash("error"),
			foodItems: foodItems,
			stalls: stalls,
			filters: filters, // Pass current filters back to the view
		});
	} catch (err) {
		console.error("Error loading food items:", err);
		req.flash("error", "Failed to load food items.");
		res.render("food-items", {
			title: "Food Items - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			foodItems: [],
			stalls: [],
			filters: filters,
		});
	}
});

// =====================
// POST /food-items/add (Admin Only)
// =====================
router.post(
	"/food-items/add",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { name, price, description, stall_id } = req.body;

		if (!name || !price || !stall_id) {
			req.flash(
				"error",
				"Name, Price, and Stall are required to add a food item."
			);
			return res.redirect("/food-items");
		}

		try {
			const insertSql = `
      INSERT INTO food_items (name, price, description, stall_id, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
			await queryDB(insertSql, [
				name,
				parseFloat(price),
				description || null,
				stall_id,
			]);

			req.flash("success", "Food item added successfully!");
			res.redirect("/food-items");
		} catch (err) {
			console.error("Database error adding food item:", err);
			req.flash("error", "Failed to add food item. Please try again.");
			res.redirect("/food-items");
		}
	}
);

// =====================
// POST /food-items/edit/:id (Admin Only)
// =====================
router.post(
	"/food-items/edit/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;
		const { name, price, description, stall_id } = req.body;

		if (!name || !price || !stall_id) {
			req.flash(
				"error",
				"Name, Price, and Stall are required to update a food item."
			);
			return res.redirect(`/food-items`);
		}

		try {
			const updateSql = `
      UPDATE food_items
      SET name = ?, price = ?, description = ?, stall_id = ?
      WHERE id = ?
    `;
			await queryDB(updateSql, [
				name,
				parseFloat(price),
				description || null,
				stall_id,
				id,
			]);

			req.flash("success", "Food item updated successfully!");
			res.redirect("/food-items");
		} catch (err) {
			console.error("Database error updating food item:", err);
			req.flash("error", "Failed to update food item. Please try again.");
			res.redirect(`/food-items`);
		}
	}
);

// =====================
// POST /food-items/delete/:id (Admin Only)
// =====================
router.post(
	"/food-items/delete/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;

		try {
			const deleteSql = "DELETE FROM food_items WHERE id = ?";
			await queryDB(deleteSql, [id]);

			req.flash("success", "Food item deleted successfully!");
			res.redirect("/food-items");
		} catch (err) {
			console.error("Database error deleting food item:", err);
			req.flash("error", "Failed to delete food item. Please try again.");
			res.redirect("/food-items");
		}
	}
);

module.exports = router;
