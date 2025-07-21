const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
require("dotenv").config();

const app = express();

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "public/images");
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

// Database connection
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

// Session Middleware
app.use(
	session({
		secret: process.env.SESSION_SECRET || "hawker-hero-secret",
		resave: false,
		saveUninitialized: true,
		cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
	})
);

app.use(flash());
app.set("view engine", "ejs");

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
	if (req.session.user) {
		return next();
	} else {
		req.flash("error", "Please log in to view this resource.");
		return res.redirect("/login");
	}
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
	if (req.session.user && req.session.user.role === "admin") {
		return next();
	} else {
		req.flash("error", "You do not have permission to view this resource.");
		return res.redirect("/");
	}
};

// Validation middleware for registration
const validateRegistration = (req, res, next) => {
	const { username, email, password } = req.body;

	if (!username || !email || !password) {
		req.flash("error", "All fields are required.");
		req.flash("formData", req.body);
		return res.redirect("/register");
	}

	if (password.length < 6) {
		req.flash("error", "Password must be at least 6 characters long.");
		req.flash("formData", req.body);
		return res.redirect("/register");
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		req.flash("error", "Please enter a valid email address.");
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
		if (err) {
			console.error("Database error:", err);
			req.flash("error", "Registration failed. Please try again.");
			return res.redirect("/register");
		}

		if (results.length > 0) {
			req.flash("error", "Username or email already exists.");
			req.flash("formData", req.body);
			return res.redirect("/register");
		}

		const insertSql =
			"INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, SHA1(?), ?, NOW())";
		const userRole = role || "user";

		db.query(
			insertSql,
			[username, email, password, userRole],
			(err, result) => {
				if (err) {
					console.error("Database error:", err);
					req.flash("error", "Registration failed. Please try again.");
					return res.redirect("/register");
				}
				req.flash("success", "Registration successful! Please log in.");
				res.redirect("/login");
			}
		);
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
		req.flash("error", "Email and password are required.");
		return res.redirect("/login");
	}

	const sql = "SELECT * FROM users WHERE email = ? AND password_hash = SHA1(?)";
	db.query(sql, [email, password], (err, results) => {
		if (err) {
			console.error("Database error:", err);
			req.flash("error", "Login failed. Please try again.");
			return res.redirect("/login");
		}

		if (results.length > 0) {
			req.session.user = results[0];
			req.flash("success", "Login successful!");
			return res.redirect("/dashboard");
		} else {
			req.flash("error", "Invalid email or password.");
			return res.redirect("/login");
		}
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

app.get("/favorites", checkAuthenticated, (req, res) => {
	res.render("favorites", {
		title: "My Favorites - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		favorites: [],
	});
});

app.get("/stalls", (req, res) => {
	res.render("stalls", {
		title: "Stalls - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		stalls: [],
	});
});

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

app.get("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Logout error:", err);
		}
		res.redirect("/");
	});
});

app.listen(process.env.PORT || 3000, () => {
	console.log(
		`Server is running on http://localhost:${process.env.PORT || 3000}`
	);
});
