const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
require("dotenv").config(); // Load environment variables from .env file
const methodOverride = require("method-override");

const app = express();
const PORT = process.env.PORT || 3000;

// Import route modules for different application features
const authRoutes = require("./routes/auth");
const favoritesRoutes = require("./routes/favorites");
const stallsRoutes = require("./routes/stalls");
const reviewsRoutes = require("./routes/reviews");
const recommendationsRoutes = require("./routes/recommendations");
const hawkerCentersRoutes = require("./routes/hawker-centers");
const foodItemsRoutes = require("./routes/food-items");

// Middleware setup for request parsing and static files
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static("public")); // Serve static files from public directory
app.set("view engine", "ejs"); // Set EJS as the template engine

// Session configuration for user authentication and state management
app.use(
	session({
		secret: process.env.SESSION_SECRET || "your-secret-key",
		resave: false,
		saveUninitialized: false,
		cookie: { secure: false },
	})
);

app.use(flash());

// Route configuration
app.use("/", authRoutes);
app.use("/", favoritesRoutes);
app.use("/", stallsRoutes);
app.use("/", reviewsRoutes);
app.use("/", recommendationsRoutes);
app.use("/", hawkerCentersRoutes);
app.use("/", foodItemsRoutes);

// Start server
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
