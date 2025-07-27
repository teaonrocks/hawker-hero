const db = require("../config/database");

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
	if (req.session.user) return next();
	req.flash("error", "Please log in to view this resource.");
	res.redirect("/login");
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
	if (req.session.user && req.session.user.role === "admin") return next();
	req.flash("error", "You do not have permission to view this resource.");
	res.redirect("/");
};

// Check favorite ownership or admin
const checkFavoriteOwnershipOrAdmin = (req, res, next) => {
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
};

module.exports = {
	checkAuthenticated,
	checkAdmin,
	checkFavoriteOwnershipOrAdmin,
};
