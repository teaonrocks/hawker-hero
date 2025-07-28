const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

// Setup Multer for image uploads to public/images directory
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "public/images");
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

// GET - Hawker Centers page with search and facilities filtering
router.get("/hawker-centers", async (req, res) => {
	// Get filter values from the query string
	const { search, facilities } = req.query;
	const filters = {
		search: search || "",
		facilities: facilities || "",
	};

	// Base SQL query with JOIN to get stall count for each hawker center
	let sql = `
		SELECT hc.*, 
		       COUNT(s.id) as stall_count
		FROM hawker_centers hc
		LEFT JOIN stalls s ON hc.id = s.center_id
	`;

	// Dynamically build WHERE clause to prevent SQL injection
	const whereClauses = [];
	const params = [];

	if (search) {
		whereClauses.push("(hc.name LIKE ? OR hc.address LIKE ?)");
		params.push(`%${search}%`, `%${search}%`);
	}
	if (facilities) {
		whereClauses.push("hc.facilities LIKE ?");
		params.push(`%${facilities}%`);
	}

	if (whereClauses.length > 0) {
		sql += ` WHERE ${whereClauses.join(" AND ")}`;
	}

	sql += " GROUP BY hc.id ORDER BY hc.name ASC";

	try {
		const centers = await queryDB(sql, params);

		res.render("hawker-centers", {
			title: "Hawker Centers - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			centers: centers,
			filters: filters, // Pass current filters back to the view
		});
	} catch (err) {
		console.error("Database error fetching hawker centers:", err);
		req.flash("error", "Failed to load hawker centers.");
		res.render("hawker-centers", {
			title: "Hawker Centers - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			centers: [],
			filters: filters,
		});
	}
});

// POST - Add new hawker center (Admin Only)
router.post(
	"/hawker-centers/add",
	checkAuthenticated,
	checkAdmin,
	upload.single("image"),
	async (req, res) => {
		const { name, address, facilities } = req.body;
		const image_url = req.file ? req.file.filename : null;

		if (!name || !address) {
			req.flash(
				"error",
				"Name and Address are required to add a hawker center."
			);
			return res.redirect("/hawker-centers");
		}

		try {
			const insertSql =
				"INSERT INTO hawker_centers (name, address, facilities, image_url, created_at) VALUES (?, ?, ?, ?, NOW())";
			await queryDB(insertSql, [name, address, facilities || null, image_url]);

			req.flash("success", "Hawker center added successfully!");
			res.redirect("/hawker-centers");
		} catch (err) {
			console.error("Database error adding hawker center:", err);
			req.flash("error", "Failed to add hawker center. Please try again.");
			res.redirect("/hawker-centers");
		}
	}
);

// POST - Update hawker center (Admin Only)
router.post(
	"/hawker-centers/edit/:id",
	checkAuthenticated,
	checkAdmin,
	upload.single("image"),
	async (req, res) => {
		const { id } = req.params;
		const { name, address, facilities } = req.body;
		const image_url = req.file ? req.file.filename : null;

		if (!name || !address) {
			req.flash(
				"error",
				"Name and Address are required to update a hawker center."
			);
			return res.redirect("/hawker-centers");
		}

		try {
			let updateSql, params;

			if (image_url) {
				updateSql =
					"UPDATE hawker_centers SET name = ?, address = ?, facilities = ?, image_url = ? WHERE id = ?";
				params = [name, address, facilities || null, image_url, id];
			} else {
				updateSql =
					"UPDATE hawker_centers SET name = ?, address = ?, facilities = ? WHERE id = ?";
				params = [name, address, facilities || null, id];
			}

			await queryDB(updateSql, params);

			req.flash("success", `Hawker center ID ${id} updated successfully!`);
			res.redirect("/hawker-centers");
		} catch (err) {
			console.error("Database error updating hawker center:", err);
			req.flash("error", "Failed to update hawker center. Please try again.");
			res.redirect("/hawker-centers");
		}
	}
);

// POST - Delete hawker center (Admin Only)
router.post(
	"/hawker-centers/delete/:id",
	checkAuthenticated,
	checkAdmin,
	async (req, res) => {
		const { id } = req.params;

		try {
			// Check if there are any stalls associated with this hawker center
			const stallCheck = await queryDB(
				"SELECT COUNT(*) as count FROM stalls WHERE center_id = ?",
				[id]
			);

			if (stallCheck[0].count > 0) {
				req.flash(
					"error",
					"Cannot delete hawker center. Please remove all associated stalls first."
				);
				return res.redirect("/hawker-centers");
			}

			const deleteSql = "DELETE FROM hawker_centers WHERE id = ?";
			await queryDB(deleteSql, [id]);

			req.flash("success", `Hawker center ID ${id} deleted successfully!`);
			res.redirect("/hawker-centers");
		} catch (err) {
			console.error("Database error deleting hawker center:", err);
			req.flash("error", "Failed to delete hawker center. Please try again.");
			res.redirect("/hawker-centers");
		}
	}
);

module.exports = router;
