const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
require("dotenv").config();

const app = express();

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

// MySQL connection
const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});
db.connect((err) => {
	if (err) {
		console.error("Error connection to MySQL:", err);
		return;
	}
	console.log("Connected to MySQL database");
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

//functions
function checkFavoriteOwnershipOrAdmin(req, res, next) {
	const favoriteId = req.params.id;
	const userId = req.session.user.id;
	const isAdmin = req.session.user.isAdmin;

	const sql = "SELECT * FROM favorites WHERE id = ?";
	db.query(sql, [favoriteId], (err, results) => {
		if (err) return res.status(500).send("Database error");
		if (!results.length) return res.status(404).send("Favorite not found");

		const favorite = results[0];
		if (favorite.user_id === userId || isAdmin) {
			next();
		} else {
			return res.status(403).send("Unauthorized");
		}
	});
}

// Session Middleware
app.use(
	session({
		secret: process.env.SESSION_SECRET || "hawker-hero-secret",
		resave: false,
		saveUninitialized: true,
		cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
	})
);
app.use(flash());
app.set("view engine", "ejs");

// Helper function to promisify db.query
// IMPORTANT: This needs to be defined BEFORE it's used in your routes.
const queryDB = (sql, params = []) => {
	return new Promise((resolve, reject) => {
		db.query(sql, params, (err, results) => {
			if (err) {
				return reject(err);
			}
			resolve(results);
		});
	});
};

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
	if (req.session.user) return next();
	req.flash("error", "Please log in to view this resource.");
	res.redirect("/login");
};

const checkAdmin = (req, res, next) => {
	if (req.session.user && req.session.user.role === "admin") return next();
	req.flash("error", "You do not have permission to view this resource.");
	res.redirect("/");
};

const validateRegistration = (req, res, next) => {
	const { username, email, password } = req.body;
	if (!username || !email || !password) {
		req.flash("error", "All fields are required.");
		req.flash("formData", req.body);
		return res.redirect("/register");
	}
	if (password.length < 6) {
		req.flash("error", "Password must be at least 6 characters.");
		req.flash("formData", req.body);
		return res.redirect("/register");
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		req.flash("error", "Enter a valid email.");
		req.flash("formData", req.body);
		return res.redirect("/register");
	}
	next();
};

// Routes
app.get("/", (req, res) => {
	res.render("index", {
		title: "Hawker Hero - Home",
		user: req.session.user,
		messages: req.flash("success"),
	});
});

app.get("/register", (req, res) => {
	res.render("auth/register", {
		title: "Register - Hawker Hero",
		messages: req.flash("error"),
		formData: req.flash("formData")[0],
	});
});

app.post("/register", validateRegistration, (req, res) => {
	const { username, email, password, role } = req.body;
	const checkUserSql = "SELECT * FROM users WHERE email = ? OR username = ?";
	db.query(checkUserSql, [email, username], (err, results) => {
		if (err || results.length > 0) {
			req.flash("error", results.length ? "User exists." : "DB error.");
			req.flash("formData", req.body);
			return res.redirect("/register");
		}
		const userRole = role || "user";
		const insertSql =
			"INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, SHA1(?), ?, NOW())";
		db.query(insertSql, [username, email, password, userRole], (err) => {
			if (err) {
				req.flash("error", "Registration failed.");
				return res.redirect("/register");
			}
			req.flash("success", "Registered! Please log in.");
			res.redirect("/login");
		});
	});
});

app.get("/login", (req, res) => {
	res.render("auth/login", {
		title: "Login - Hawker Hero",
		messages: req.flash("success"),
		errors: req.flash("error"),
	});
});

app.post("/login", (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		req.flash("error", "Email and password required.");
		return res.redirect("/login");
	}
	const sql = "SELECT * FROM users WHERE email = ? AND password_hash = SHA1(?)";
	db.query(sql, [email, password], (err, results) => {
		if (err || results.length === 0) {
			req.flash("error", "Invalid login.");
			return res.redirect("/login");
		}
		req.session.user = results[0];
		req.flash("success", "Login successful!");
		res.redirect("/dashboard");
	});
});

app.get("/dashboard", checkAuthenticated, (req, res) => {
	res.render("dashboard", {
		title: "Dashboard - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		errors: req.flash("error"),
	});
});

app.get("/admin", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("admin/dashboard", {
		title: "Admin Dashboard - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		stats: { users: 0, hawker_centers: 0, stalls: 0, reviews: 0 },
	});
});

// List favorites with role-based access control
app.get("/favorites", checkAuthenticated, (req, res) => {
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
app.post("/favorites/add", checkAuthenticated, (req, res) => {
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
app.get(
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
app.post(
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
app.post(
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

// Hawker Stalls
app.get("/stalls", (req, res) => {
	const { search, cuisine, location } = req.query;

	const cuisineQuery = "SELECT DISTINCT cuisine_type FROM stalls";
	db.query(cuisineQuery, (err, cuisineResults) => {
		if (err) {
			console.error("Error fetching cuisines:", err);
			req.flash("error", "Failed to load cuisines");
			return res.redirect("/");
		}
		const cuisineList = cuisineResults; // ✅ just use the full array

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
			if (err) throw err;
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

app.get("/stalls/new", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("stalls-new", {
		title: "Add Stall",
		user: req.session.user,
	});
});

app.post(
	"/stalls",
	checkAuthenticated,
	checkAdmin,
	upload.single("image"),
	(req, res) => {
		const { name, location, cuisine } = req.body;
		const image = req.file ? req.file.filename : null;

		db.query(
			"INSERT INTO stalls (name, location, cuisine, image) VALUES (?, ?, ?, ?)",
			[name, location, cuisine, image],
			(err) => {
				if (err) throw err;
				res.redirect("/stalls");
			}
		);
	}
);

app.get("/stalls/:id", async (req, res) => {
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

app.get("/stalls/:id/edit", checkAuthenticated, checkAdmin, (req, res) => {
	const { id } = req.params;
	db.query("SELECT * FROM stalls WHERE id = ?", [id], (err, results) => {
		if (err) throw err;
		res.render("stalls-edit", { stall: results[0], title: "Edit Stall" });
	});
});

app.put("/stalls/:id", checkAuthenticated, checkAdmin, (req, res) => {
	const { id } = req.params;
	const { name, location, cuisine } = req.body;
	db.query(
		"UPDATE stalls SET name = ?, location = ?, cuisine = ? WHERE id = ?",
		[name, location, cuisine, id],
		(err) => {
			if (err) throw err;
			res.redirect("/stalls");
		}
	);
});

app.delete("/stalls/:id", async (req, res) => {
	const { id } = req.params;
	try {
		await queryDB("DELETE FROM stalls WHERE id = ?", [id]);
		req.flash("success", "Stall deleted successfully.");
		res.redirect("/stalls");
	} catch (err) {
		console.error("Error deleting stall:", err);
		req.flash("error", "Failed to delete stall.");
		res.redirect("/stalls");
	}
});

// Other modules
app.get("/hawker-centers", (req, res) => {
	res.render("hawker-centers", {
		title: "Hawker Centers - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		centers: [],
	});
});
app.get("/reviews", (req, res) => {
	res.render("reviews", {
		title: "Reviews - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		reviews: [],
	});
});
app.get("/food-items", (req, res) => {
	res.render("food-items", {
		title: "Food Items - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		foodItems: [],
	});
});

// ... (rest of your existing app.js code up to the recommendations routes)

// Recommendations Routes
app.get("/recommendations", async (req, res) => {
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

// Route to handle adding a new recommendation (Admin Only)
app.post(
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

// Route to handle updating a recommendation (Admin Only)
app.post(
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

// Route to handle deleting a recommendation (Admin Only)
app.post(
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

app.get("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Logout error:", err);
			// Optionally, you might flash an error message here if destroy fails
			req.flash("error", "Could not log out. Please try again.");
			return res.redirect("/dashboard"); // Or wherever they were
		}
		// Redirect to the homepage after successful logout
		res.redirect("/");
	});
});

app.listen(process.env.PORT || 3000, () => {
	console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
});
