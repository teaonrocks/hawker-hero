const mysql = require("mysql2");
require("dotenv").config();

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

module.exports = db;
