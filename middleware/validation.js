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

module.exports = {
	validateRegistration,
};
