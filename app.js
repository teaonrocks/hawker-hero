const express = require("express");
const mysql = require("mysql2");
const app = express();
const multer = require("multer");
require("dotenv").config();

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "public/images");
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
	host: process.env.HOST,
	user: process.env.USERNAME,
	password: process.env.PASSWORD,
	database: process.env.DATABASE,
});

connection.connect((err) => {
	if (err) {
		console.error("Error connection to MySQL:", err);
		return;
	}
	console.log("Connected to MySQL database");
});

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.use(express.static("public"));

app.get("/", (req, res) => {
	res.render("index", { title: "Hawker Hero - Home" });
});

app.listen(3000, () => {
	console.log("Server is running on http://localhost:3000");
});
