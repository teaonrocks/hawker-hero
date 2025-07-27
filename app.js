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


// Admin: Manage Favorites
app.get("/admin/manage-favorites", checkAuthenticated, checkAdmin, async (req, res) => {
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
app.get("/admin/edit-favorites/:id", checkAuthenticated, checkAdmin, async (req, res) => {
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

app.post("/admin/edit-favorites/:id", checkAuthenticated, checkAdmin, async (req, res) => {
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

// List user favorites  with pagination
app.get("/favorites", checkAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    let totalQuery, dataQuery, countParams, dataParams;

    if (search) {
      // If search is active
      totalQuery = `
        SELECT COUNT(*) AS total
        FROM favorites f
        LEFT JOIN stalls s ON f.stall_id = s.id
        LEFT JOIN food_items fd ON f.food_id = fd.id
        WHERE f.user_id = ? AND (s.name LIKE ? OR fd.name LIKE ?)
      `;


      dataQuery = `
        SELECT f.*, s.name AS stall_name, fd.name AS food_name
        FROM favorites f
        LEFT JOIN stalls s ON f.stall_id = s.id
        LEFT JOIN food_items fd ON f.food_id = fd.id
        WHERE f.user_id = ? AND (s.name LIKE ? OR fd.name LIKE ?)
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;

      countParams = [req.session.user.id, search, search];
      dataParams = [req.session.user.id, search, search, limit, offset];
    } else {
      // No search term
      totalQuery = `
        SELECT COUNT(*) AS total
        FROM favorites
        WHERE user_id = ?
      `;

      dataQuery = `
        SELECT f.*, s.name AS stall_name, fd.name AS food_name
        FROM favorites f
        LEFT JOIN stalls s ON f.stall_id = s.id
        LEFT JOIN food_items fd ON f.food_id = fd.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;

      countParams = [req.session.user.id];
      dataParams = [req.session.user.id, limit, offset];
    }

    const [{ total }] = await queryDB(totalQuery, countParams);
    const favorites = await queryDB(dataQuery, dataParams);
    const totalPages = Math.ceil(total / limit);

    res.render("favorites", {
      title: "My Favorites",
      user: req.session.user,
      favorites,
      messages: req.flash("success"),
      errors: req.flash("error"),
      currentPage: page,
      totalPages,
      search: req.query.search || ""
    });
  } catch (err) {
    console.error("Error loading favorites:", err);
    req.flash("error", "Failed to load favorites.");
    res.render("favorites", {
      title: "My Favorites",
      user: req.session.user,
      favorites: [],
      messages: req.flash("success"),
      errors: req.flash("error"),
      currentPage: 1,
      totalPages: 1,
      search: req.query.search || ""
    });
  }
});


// Show all users' favorites
app.get("/favorites/others", checkAuthenticated, async (req, res) => {
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


// Add favorite (GET)
app.get("/favorites/add", checkAuthenticated, async (req, res) => {
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
app.post("/favorites/add", checkAuthenticated, (req, res) => {
  const { stall_id, food_id, notes } = req.body;
  const user_id = req.session.user.id;

  const checkSql = "SELECT * FROM favorites WHERE user_id = ? AND stall_id = ? AND food_id = ?";
  db.query(checkSql, [user_id, stall_id, food_id], (err, results) => {
    if (err) return res.status(500).send("Database error");
    if (results.length > 0) {
      req.flash("success", "Already in favorites!");
      return res.redirect("/favorites");
    }

    const insertSql = `
      INSERT INTO favorites (user_id, stall_id, food_id, notes, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    db.query(insertSql, [user_id, stall_id || null, food_id || null, notes || null], (err) => {
      if (err) return res.status(500).send("Database error");
      req.flash("success", "Added to favorites!");
      res.redirect("/favorites");
    });
  });
});

// Edit favorite form (GET)
app.get("/favorites/edit/:id", checkAuthenticated, async (req, res) => {
  try {
    const [favorite] = await queryDB(
      `SELECT f.*, s.name AS stall_name, fd.name AS food_name
       FROM favorites f
       LEFT JOIN stalls s ON f.stall_id = s.id
       LEFT JOIN food_items fd ON f.food_id = fd.id
       WHERE f.id = ? AND f.user_id = ?`, [req.params.id, req.session.user.id]
    );
    if (!favorite) {
      req.flash("error", "Favorite not found or not yours.");
      return res.redirect("/favorites");
    }
    const stalls = await queryDB(`SELECT id, name FROM stalls ORDER BY name ASC`);
    const foodItems = await queryDB(`SELECT id, name FROM food_items ORDER BY name ASC`);
    res.render("editfavorites", {
      title: "Edit Favorite",
      user: req.session.user,
      favorite,
      stalls,
      foodItems,
	  messages: req.flash("success"),
      errors: req.flash("error"),
    });
  } catch (err) {
    req.flash("error", "Database error.");
    res.redirect("/favorites");
  }
});

// Edit favorite submit (POST)()
app.post("/favorites/edit/:id", checkAuthenticated, async (req, res) => {
  const { stall_id, food_id, notes } = req.body;
  try {
    // Only update if the favorite belongs to the user
    await queryDB(
      `UPDATE favorites SET stall_id = ?, food_id = ?, notes = ? WHERE id = ? AND user_id = ?`,
      [stall_id || null, food_id || null, notes, req.params.id, req.session.user.id]
    );
    req.flash("success", "Favorite updated.");
    res.redirect("/favorites");
  } catch (err) {
    req.flash("error", "Failed to update favorite.");
    res.redirect("/favorites/edit/" + req.params.id);
  }
});

// Delete favorite
app.get("/favorites/delete/:id", checkAuthenticated, async (req, res) => {
  try {
    // Only delete if the favorite belongs to the user
    await queryDB(
      `DELETE FROM favorites WHERE id = ? AND user_id = ?`,
      [req.params.id, req.session.user.id]
    );
    req.flash("success", "Favorite deleted.");
  } catch (err) {
    req.flash("error", "Failed to delete favorite.");
  }
  res.redirect("/favorites");
});


				res.redirect(redirectTo);
			});
		});
	}
);

// Hawker Stalls
app.get("/stalls", (req, res) => {
	const { search, cuisine, location } = req.query;

	const cuisineQuery = "SELECT DISTINCT cuisine FROM stalls";
	db.query(cuisineQuery, (err, cuisineResults) => {
		if (err) throw err;
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
  const { rating, stall, sort, search, min_price, max_price } = req.query;

  console.log("Received filters:", { rating, stall, sort, search, min_price, max_price });

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
    db.query(`
      SELECT c.*, u.username 
      FROM comments c
      JOIN users u ON c.user_id = u.id
    `, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

  Promise.all([reviewQuery, stallQuery, commentQuery])
    .then(([reviews, stallOptions, allComments]) => {
      // ✅ Calculate average rating here
      let averageRating = 0;
      if (reviews.length > 0) {
        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        averageRating = total / reviews.length;
      }

      // Group comments by review ID
      const commentsByReview = {};
      allComments.forEach(comment => {
        if (!commentsByReview[comment.review_id]) {
          commentsByReview[comment.review_id] = [];
        }
        commentsByReview[comment.review_id].push(comment);
      });

      // ✅ Now averageRating is defined, safe to render
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
        averageRating, // ← this is now correctly included
        commentsByReview
      });
    })
    .catch(err => {
      console.error("Error loading reviews page:", err);
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

app.post("/reviews/:id/comments", (req, res) => {
	if (!req.session.user) return res.redirect("/login");

	const review_id = req.params.id;
	const user_id = req.session.user.id;
	const comment = req.body.comment;

	const sql = "INSERT INTO comments (review_id, user_id, comment) VALUES (?, ?, ?)";
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

// Delete comment route
app.get("/comments/delete/:id", checkAuthenticated, (req, res) => {
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

// GET form to edit comment
app.get("/comments/edit/:id", checkAuthenticated, (req, res) => {
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
			messages: req.flash("success").concat(req.flash("error"))
		});
	});
});


// POST update comment
app.post("/comments/edit/:id", checkAuthenticated, (req, res) => {
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
