const express = require("express");
const router = express.Router();

router.get("/hawker-centers", (req, res) => {
	res.render("hawker-centers", {
		title: "Hawker Centers - Hawker Hero",
		user: req.session.user,
		messages: req.flash("success"),
		centers: [],
	});
});

module.exports = router;
