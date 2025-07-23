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
		cb(null, "public/images");
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
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

// Middleware
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

// Favourites
app.post("/favourites/:stallId", checkAuthenticated, (req, res) => {
	const stallId = parseInt(req.params.stallId);
	if (!req.session.favourites) req.session.favourites = [];
	const idx = req.session.favourites.indexOf(stallId);
	if (idx === -1) req.session.favourites.push(stallId);
	else req.session.favourites.splice(idx, 1);
	res.redirect("/stalls");
});

app.get("/favourites", checkAuthenticated, (req, res) => {
	res.render("favourites", {
		title: "My Favourites - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		favourites: req.session.favourites || [],
	});
});

// Hawker Stalls
app.get("/stalls", (req, res) => {
	const { search, cuisine, location } = req.query;
  
	const cuisineQuery = "SELECT DISTINCT cuisine FROM stalls";
	db.query(cuisineQuery, (err, cuisineResults) => {
	  if (err) throw err;
	  const cuisineList = cuisineResults.map(row => row.cuisine);

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
		  favourites: req.session.favourites || []
		});
	  });
	});
});
  

app.get("/stalls/new", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("stalls-new", { title: "Add Stall" });
});

app.post("/stalls", checkAuthenticated, checkAdmin, (req, res) => {
	const { name, location, cuisine } = req.body;
	db.query("INSERT INTO stalls (name, location, cuisine) VALUES (?, ?, ?)", [name, location, cuisine], (err) => {
		if (err) throw err;
		res.redirect("/stalls");
	});
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
	db.query("UPDATE stalls SET name = ?, location = ?, cuisine = ? WHERE id = ?", [name, location, cuisine, id], (err) => {
		if (err) throw err;
		res.redirect("/stalls");
	});
});

app.delete("/stalls/:id", checkAuthenticated, checkAdmin, (req, res) => {
	const { id } = req.params;
	db.query("DELETE FROM stalls WHERE id = ?", [id], (err) => {
		if (err) throw err;
		res.redirect("/stalls");
	});
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
app.get("/recommendations", (req, res) => {
	res.render("recommendations", {
		title: "Recommendations - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		recommendations: [],
	});
});

// Logout
app.get("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) console.error("Logout error:", err);
		res.redirect("/");
	});
});

app.listen(process.env.PORT || 3000, () => {
	console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
});
