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
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const offset = (page - 1) * limit;

    // Base query
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

    // Count query (for pagination)
    let countSql = `
        SELECT COUNT(*) as total
        FROM favorites f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN stalls s ON f.stall_id = s.id
        LEFT JOIN food_items fd ON f.food_id = fd.id
        WHERE 1=1
    `;

    const params = [];
    const countParams = [];

    // Regular users can only see their own favorites
    if (!isAdmin) {
        sql += " AND f.user_id = ?";
        countSql += " AND f.user_id = ?";
        params.push(userId);
        countParams.push(userId);
    }
    // If admin is viewing a specific user's favorites
    else if (searchUser) {
        sql += " AND f.user_id = ?";
        countSql += " AND f.user_id = ?";
        params.push(searchUser);
        countParams.push(searchUser);
    }

    // ✅ Fixed Search functionality
    if (search) {
        const searchTerm = `%${search}%`;

        sql += ` AND (
            s.name LIKE ? OR 
            fd.name LIKE ? OR 
            u.username LIKE ? OR 
            f.notes LIKE ?
        )`;

        countSql += ` AND (
            s.name LIKE ? OR 
            fd.name LIKE ? OR 
            u.username LIKE ? OR 
            f.notes LIKE ?
        )`;

        for (let i = 0; i < 4; i++) {
            params.push(searchTerm);
            countParams.push(searchTerm);
        }
    }

    sql += " ORDER BY f.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    // First get the total count
    db.query(countSql, countParams, (err, countResult) => {
        if (err) {
            console.error("Error counting favorites:", err);
            return res.status(500).render("error", {
                title: "Error",
                message: "Failed to load favorites",
                error: { status: 500 },
            });
        }

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Then get the paginated data
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
                    `SELECT DISTINCT u.id, u.username 
                     FROM favorites f 
                     JOIN users u ON f.user_id = u.id 
                     ORDER BY u.username`,
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
                    // Pagination variables
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasNext: page < totalPages,
                        hasPrev: page > 1
                    }
                });
            }
        });
    });
});
// Add favorite (GET)
router.get("/favorites/add", checkAuthenticated, async (req, res) => {
  try {
    const stalls = await queryDB(`
      SELECT s.id, s.name, hc.name AS center_name
      FROM stalls s
      LEFT JOIN hawker_centers hc ON s.center_id = hc.id
      ORDER BY s.name ASC
    `);
    const foodItems = await queryDB(`
      SELECT fi.id, fi.name, fi.stall_id
      FROM food_items fi
      ORDER BY fi.name ASC
    `);
    res.render("addfavorites", {
      title: "Add Favorite",
      user: req.session.user,
      stalls,
      foodItems,
      messages: req.flash("success"),
      errors: req.flash("error"),
    });
  } catch (err) {
    req.flash("error", "Failed to load add favorite form.");
    res.redirect("/favorites");
  }
});

// Add favorite (POST)
router.post("/favorites/add", checkAuthenticated, (req, res) => {
	console.log("Add favorite request body:", req.body); // Debug log

	const { stall_id, food_id, notes, redirect_to } = req.body;
	const user_id = req.session.user.id;
	const redirectPath = redirect_to || "/favorites";

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

// Show all users' favorites
router.get("/favorites/others", checkAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const offset = (page - 1) * limit;

  try {
    const [{ total }] = await queryDB(
      `SELECT COUNT(*) AS total FROM favorites WHERE user_id != ?`, [req.session.user.id]
    );
    const favorites = await queryDB(
      `SELECT f.*, u.username, s.name AS stall_name, fd.name AS food_name
       FROM favorites f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN stalls s ON f.stall_id = s.id
       LEFT JOIN food_items fd ON f.food_id = fd.id
       WHERE f.user_id != ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.session.user.id, limit, offset]
    );
    const totalPages = Math.ceil(total / limit);

    res.render("users-favorites", {
      title: "Other Users' Favorites",
      user: req.session.user,
      favorites,
      messages: req.flash("success"),
      errors: req.flash("error"),
      currentPage: page,
      totalPages
    });
  } catch (err) {
    req.flash("error", "Failed to load others' favorites.");
    res.render("users-favorites", {
      title: "Other Users' Favorites",
      user: req.session.user,
      favorites: [],
      messages: req.flash("success"),
      errors: req.flash("error"),
      currentPage: 1,
      totalPages: 1
    });
  }
});


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
		const isAdmin = req.session.user.role === "admin";

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
//Admin: Delete
router.post(
  "/admin/favorites/delete/:id",
  checkAuthenticated,
  checkAdmin,
  (req, res) => {
    const { id } = req.params;
    const redirectTo = req.body.redirect_to || "/admin/manage-favorites";

    db.query("DELETE FROM favorites WHERE id = ?", [id], (err, result) => {
      if (err) {
        console.error("Error deleting favorite:", err);
        req.flash("error", "Failed to delete favorite");
        return res.redirect(redirectTo);
      }

      if (result.affectedRows === 0) {
        req.flash("warning", "Favorite not found or already deleted");
      } else {
        console.log(`Favorite ${id} deleted by admin`);
        req.flash("success", "Favorite removed successfully");
      }
      res.redirect(redirectTo);
    });
  }
);

// Admin: Manage Favorites
router.get("/admin/manage-favorites", checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const favorites = await queryDB(`
      SELECT f.id, f.notes, f.created_at,
             u.username,
             s.name AS stall_name,
             fd.name AS food_name
      FROM favorites f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN stalls s ON f.stall_id = s.id
      LEFT JOIN food_items fd ON f.food_id = fd.id
      ORDER BY f.created_at DESC
    `);

    res.render("admin/manage-favorites", {
      title: "Manage Favorites - Admin",
      user: req.session.user,
      favorites,
      messages: req.flash("success"),
      errors: req.flash("error"),
    });
  } catch (err) {
    console.error("Database error fetching favorites:", err);
    req.flash("error", "Failed to load favorites.");
    res.render("admin/manage-favorites", {
      title: "Manage Favorites - Admin",
      user: req.session.user,
      favorites: [],
      messages: req.flash("success"),
      errors: req.flash("error"),
    });
  }
});
// Admin: Edit Favorites
router.get("/admin/edit-favorites/:id", checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const [favorite] = await queryDB(
      `SELECT f.*, s.name AS stall_name, fd.name AS food_name
       FROM favorites f
       LEFT JOIN stalls s ON f.stall_id = s.id
       LEFT JOIN food_items fd ON f.food_id = fd.id
       WHERE f.id = ?`, [req.params.id]
    );
    if (!favorite) {
      req.flash("error", "Favorite not found.");
      return res.redirect("/admin/manage-favorites");
    }
    res.render("admin/edit-favorites", {
      title: "Edit Favorite - Admin",
      user: req.session.user,
      favorite
    });
  } catch (err) {
    req.flash("error", "Database error.");
    res.redirect("/admin/manage-favorites");
  }
});

router.post("/admin/edit-favorites/:id", checkAuthenticated, checkAdmin, async (req, res) => {
  const { stall_id, food_id, notes } = req.body;
  try {
    await queryDB(
      `UPDATE favorites SET stall_id = ?, food_id = ?, notes = ? WHERE id = ?`,
      [stall_id || null, food_id || null, notes, req.params.id]
    );
    req.flash("success", "Favorite updated successfully.");
    res.redirect("/admin/manage-favorites");
  } catch (err) {
    req.flash("error", "Failed to update favorite.");
    res.redirect("/admin/edit-favorites/" + req.params.id);
  }
});

module.exports = router;
