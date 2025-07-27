const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { validateRegistration } = require("../middleware/validation");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");

// Home route
router.get("/", (req, res) => {
	res.render("index", {
		title: "Hawker Hero - Home",
		user: req.session.user,
		messages: req.flash("success"),
	});
});

// Register routes
router.get("/register", (req, res) => {
	res.render("auth/register", {
		title: "Register - Hawker Hero",
		messages: req.flash("error"),
		formData: req.flash("formData")[0],
	});
});

// Update the register route in auth.js
router.post("/register", validateRegistration, (req, res) => {
	const { username, email, password, role } = req.body;
	const checkUserSql = "SELECT * FROM users WHERE email = ? OR username = ?";

	db.query(checkUserSql, [email, username], (err, results) => {
		if (err) {
			console.error("Database error during user check:", err);
			req.flash(
				"error",
				"Registration failed due to database error. Please try again."
			);
			req.flash("formData", req.body);
			return res.redirect("/register");
		}

		if (results.length > 0) {
			req.flash("error", "Username or email already exists.");
			req.flash("formData", req.body);
			return res.redirect("/register");
		}

		const userRole = role || "user";
		const insertSql =
			"INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, SHA1(?), ?, NOW())";

		db.query(
			insertSql,
			[username, email, password, userRole],
			(err, result) => {
				if (err) {
					console.error("Database error during user registration:", err);
					req.flash("error", "Registration failed. Please try again.");
					req.flash("formData", req.body);
					return res.redirect("/register");
				}

				req.flash("success", "Registration successful! Please log in.");
				res.redirect("/login");
			}
		);
	});
});

// Login routes
router.get("/login", (req, res) => {
	res.render("auth/login", {
		title: "Login - Hawker Hero",
		messages: req.flash("success"),
		errors: req.flash("error"),
	});
});

// Update the login route in auth.js
router.post("/login", (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		req.flash("error", "Email and password are required.");
		return res.redirect("/login");
	}

	const sql = "SELECT * FROM users WHERE email = ? AND password_hash = SHA1(?)";
	db.query(sql, [email, password], (err, results) => {
		if (err) {
			console.error("Database error during login:", err);
			req.flash(
				"error",
				"Login failed due to database error. Please try again."
			);
			return res.redirect("/login");
		}

		if (results.length === 0) {
			req.flash("error", "Invalid email or password.");
			return res.redirect("/login");
		}

		req.session.user = results[0];
		req.flash("success", "Login successful!");
		res.redirect("/dashboard");
	});
});

// Dashboard and admin routes
router.get("/dashboard", checkAuthenticated, (req, res) => {
	res.render("dashboard", {
		title: "Dashboard - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		errors: req.flash("error"),
	});
});

router.get("/admin", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("admin/dashboard", {
		title: "Admin Dashboard - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		stats: { users: 0, hawker_centers: 0, stalls: 0, reviews: 0 },
	});
});

// Logout route
router.get("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Logout error:", err);
			req.flash("error", "Could not log out. Please try again.");
			return res.redirect("/dashboard");
		}
		res.redirect("/");
	});
});

module.exports = router;
