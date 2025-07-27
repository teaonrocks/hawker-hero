const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");

// Setup for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "public/images/stalls");
	},
	filename: (req, file, cb) => {
		const uniqueName = Date.now() + "-" + file.originalname;
		cb(null, uniqueName);
	},
});
const upload = multer({ storage });

// List all stalls with filtering
router.get("/stalls", (req, res) => {
	const { search, cuisine, location } = req.query;

	const cuisineQuery = "SELECT DISTINCT cuisine_type FROM stalls";
	db.query(cuisineQuery, (err, cuisineResults) => {
		if (err) {
			console.error("Error fetching cuisines:", err);
			req.flash("error", "Failed to load cuisine options");
			return res.render("stalls", {
				title: "Stalls - Hawker Hero",
				user: req.session.user,
				messages: req.flash("success"),
				errors: req.flash("error"),
				stalls: [],
				query: req.query,
				cuisines: [],
				favourites: req.session.favourites || [],
			});
		}

		const cuisineList = cuisineResults;

		let sql = "SELECT * FROM stalls WHERE 1=1";
		const params = [];

		if (search) {
			sql += " AND name LIKE ?";
			params.push(`%${search}%`);
		}

		if (cuisine) {
			sql += " AND cuisine = ?";
			params.push(cuisine);
		}

		if (location) {
			sql += " AND location LIKE ?";
			params.push(`%${location}%`);
		}

		db.query(sql, params, (err, stalls) => {
			if (err) {
				console.error("Error fetching stalls:", err);
				req.flash("error", "Failed to load stalls");
				return res.render("stalls", {
					title: "Stalls - Hawker Hero",
					user: req.session.user,
					messages: req.flash("success"),
					errors: req.flash("error"),
					stalls: [],
					query: req.query,
					cuisines: cuisineList,
					favourites: req.session.favourites || [],
				});
			}

			res.render("stalls", {
				title: "Stalls - Hawker Hero",
				user: req.session.user,
				messages: req.flash("success"),
				errors: req.flash("error"),
				stalls,
				query: req.query,
				cuisines: cuisineList,
				favourites: req.session.favourites || [],
			});
		});
	});
});

// Show form to create new stall (Admin only)
router.get("/stalls/new", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("stalls-new", {
		title: "Add Stall",
		user: req.session.user,
		messages: req.flash("success"),
		errors: req.flash("error"),
	});
});

// Create new stall (Admin only)
router.post(
	"/stalls",
	checkAuthenticated,
	checkAdmin,
	upload.single("image"),
	(req, res) => {
		const { name, location, cuisine } = req.body;
		const image = req.file ? req.file.filename : null;

		// Validation
		if (!name || !location || !cuisine) {
			req.flash("error", "All fields (name, location, cuisine) are required");
			return res.redirect("/stalls/new");
		}

		db.query(
			"INSERT INTO stalls (name, location, cuisine, image) VALUES (?, ?, ?, ?)",
			[name, location, cuisine, image],
			(err) => {
				if (err) {
					console.error("Error creating stall:", err);
					req.flash("error", "Failed to create stall. Please try again.");
					return res.redirect("/stalls/new");
				}

				req.flash("success", "Stall added successfully!");
				res.redirect("/stalls");
			}
		);
	}
);

// Show individual stall details
router.get("/stalls/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const stallSql = "SELECT * FROM stalls WHERE id = ?";
		const [stall] = await queryDB(stallSql, [id]);

		if (!stall) {
			req.flash("error", "Stall not found.");
			return res.redirect("/stalls");
		}

		// Optional: fetch food items for this stall
		const foodItemsSql = "SELECT * FROM food_items WHERE stall_id = ?";
		const foodItems = await queryDB(foodItemsSql, [id]);

		res.render("stall-detail", {
			title: stall.name + " - Hawker Hero",
			user: req.session.user,
			stall,
			foodItems,
			messages: req.flash("success"),
			errors: req.flash("error"),
		});
	} catch (err) {
		console.error("Error loading stall detail:", err);
		req.flash("error", "Error loading stall page.");
		res.redirect("/stalls");
	}
});

// Show edit form for stall (Admin only)
router.get("/stalls/:id/edit", checkAuthenticated, checkAdmin, (req, res) => {
	const { id } = req.params;
	db.query("SELECT * FROM stalls WHERE id = ?", [id], (err, results) => {
		if (err) {
			console.error("Error fetching stall for edit:", err);
			req.flash("error", "Failed to load stall for editing");
			return res.redirect("/stalls");
		}

		if (!results.length) {
			req.flash("error", "Stall not found.");
			return res.redirect("/stalls");
		}

		res.render("stalls-edit", {
			stall: results[0],
			title: "Edit Stall",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
		});
	});
});

// Update stall (Admin only)
router.put("/stalls/:id", checkAuthenticated, checkAdmin, (req, res) => {
	const { id } = req.params;
	const { name, location, cuisine } = req.body;

	// Validation
	if (!name || !location || !cuisine) {
		req.flash("error", "All fields (name, location, cuisine) are required");
		return res.redirect(`/stalls/${id}/edit`);
	}

	db.query(
		"UPDATE stalls SET name = ?, location = ?, cuisine = ? WHERE id = ?",
		[name, location, cuisine, id],
		(err, result) => {
			if (err) {
				console.error("Error updating stall:", err);
				req.flash("error", "Failed to update stall. Please try again.");
				return res.redirect(`/stalls/${id}/edit`);
			}

			if (result.affectedRows === 0) {
				req.flash("error", "Stall not found or no changes made");
				return res.redirect("/stalls");
			}

			req.flash("success", "Stall updated successfully!");
			res.redirect("/stalls");
		}
	);
});

// Delete stall (Admin only)
router.delete(
	"/stalls/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;
		try {
			const result = await queryDB("DELETE FROM stalls WHERE id = ?", [id]);

			if (result.affectedRows === 0) {
				req.flash("error", "Stall not found or already deleted");
			} else {
				req.flash("success", "Stall deleted successfully.");
			}

			res.redirect("/stalls");
		} catch (err) {
			console.error("Error deleting stall:", err);
			req.flash("error", "Failed to delete stall.");
			res.redirect("/stalls");
		}
	}
);

module.exports = router;
