const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
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
router.get("/dashboard", checkAuthenticated, async (req, res) => {
	const userId = req.session.user.id;
	
	try {
		// Get user statistics
		const [reviewsCount] = await queryDB(
			"SELECT COUNT(*) as count FROM reviews WHERE user_id = ?", 
			[userId]
		);
		
		const [favoritesCount] = await queryDB(
			"SELECT COUNT(*) as count FROM favorites WHERE user_id = ?", 
			[userId]
		);
		
		const [recommendationsCount] = await queryDB(
			"SELECT COUNT(*) as count FROM recommendations WHERE user_id = ?", 
			[userId]
		);

		// Get recent reviews (last 3)
		const recentReviews = await queryDB(`
			SELECT r.*, s.name as stall_name, s.location, hc.name as center_name
			FROM reviews r
			JOIN stalls s ON r.stall_id = s.id
			LEFT JOIN hawker_centers hc ON s.center_id = hc.id
			WHERE r.user_id = ?
			ORDER BY r.created_at DESC
			LIMIT 3
		`, [userId]);

		// Get recent favorites (last 3)
		const recentFavorites = await queryDB(`
			SELECT f.*, s.name as stall_name, s.location, hc.name as center_name,
				   fi.name as food_name
			FROM favorites f
			LEFT JOIN stalls s ON f.stall_id = s.id
			LEFT JOIN hawker_centers hc ON s.center_id = hc.id
			LEFT JOIN food_items fi ON f.food_id = fi.id
			WHERE f.user_id = ?
			ORDER BY f.created_at DESC
			LIMIT 3
		`, [userId]);

		// Get recent recommendations (last 3)
		const recentRecommendations = await queryDB(`
			SELECT rc.*, s.name as stall_name, fi.name as food_name
			FROM recommendations rc
			JOIN stalls s ON rc.stall_id = s.id
			LEFT JOIN food_items fi ON rc.food_id = fi.id
			WHERE rc.user_id = ?
			ORDER BY rc.created_at DESC
			LIMIT 3
		`, [userId]);

		// Get recent activity (combined from reviews, favorites, recommendations)
		const recentActivity = [];

		// Add recent reviews to activity
		recentReviews.forEach(review => {
			recentActivity.push({
				type: 'review',
				icon: 'bi-star-fill text-warning',
				text: `You reviewed <strong>${review.stall_name}</strong>`,
				date: review.created_at,
				details: review.rating + ' stars'
			});
		});

		// Add recent favorites to activity
		recentFavorites.forEach(favorite => {
			const itemName = favorite.food_name || favorite.stall_name;
			recentActivity.push({
				type: 'favorite',
				icon: 'bi-heart-fill text-danger',
				text: `You added <strong>${itemName}</strong> to favorites`,
				date: favorite.created_at,
				details: favorite.notes ? `Note: ${favorite.notes}` : null
			});
		});

		// Add recent recommendations to activity
		recentRecommendations.forEach(rec => {
			recentActivity.push({
				type: 'recommendation',
				icon: 'bi-lightbulb-fill text-success',
				text: `You shared a recommendation for <strong>${rec.stall_name}</strong>`,
				date: rec.created_at,
				details: rec.tip.substring(0, 50) + (rec.tip.length > 50 ? '...' : '')
			});
		});

		// Sort activity by date (most recent first) and limit to 5
		recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
		const limitedActivity = recentActivity.slice(0, 5);

		res.render("dashboard", {
			title: "Dashboard - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error"),
			stats: {
				reviewsCount: reviewsCount.count,
				favoritesCount: favoritesCount.count,
				recommendationsCount: recommendationsCount.count
			},
			recentReviews,
			recentFavorites,
			recentRecommendations,
			recentActivity: limitedActivity
		});
	} catch (error) {
		console.error("Dashboard error:", error);
		res.render("dashboard", {
			title: "Dashboard - Hawker Hero",
			user: req.session.user,
			messages: req.flash("success"),
			errors: req.flash("error").concat("Failed to load dashboard data"),
			stats: {
				reviewsCount: 0,
				favoritesCount: 0,
				recommendationsCount: 0
			},
			recentReviews: [],
			recentFavorites: [],
			recentRecommendations: [],
			recentActivity: []
		});
	}
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
