const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
require("dotenv").config();
const methodOverride = require("method-override");
const app = express();

// Import routes
const authRoutes = require("./routes/auth");
const favoritesRoutes = require("./routes/favorites");
const stallsRoutes = require("./routes/stalls");
const reviewsRoutes = require("./routes/reviews");
const recommendationsRoutes = require("./routes/recommendations");
const generalRoutes = require("./routes/general");
const foodItemsRoutes = require("./routes/food-items");

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

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

// Use routes
app.use("/", authRoutes);
app.use("/", favoritesRoutes);
app.use("/", stallsRoutes);
app.use("/", reviewsRoutes);
app.use("/", recommendationsRoutes);
app.use("/", generalRoutes);
app.use("/", foodItemsRoutes);

app.listen(process.env.PORT || 3000, () => {
	console.log(
		`Server is running on http://localhost:${process.env.PORT || 3000}`
	);
});
