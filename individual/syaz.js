// Module 5

app.get("/hawker-centers", checkAuthenticated, (req, res) => {
	const sql = "SELECT * FROM hawker_centers ORDER BY name";
	db.query(sql, (err, centers) => {
		if (err) {
			console.error(err);
			return res.status(500).send("Database error");
		}
		res.render("hawker-centers", {
			title: "Hawker Centers",
			user: req.session.user,
			messages: req.flash("success"),
			centers: centers, 
		});
	});
});

app.get("/admin/hawker-centers", checkAuthenticated, checkAdmin, (req, res) => {
  const sql = "SELECT * FROM hawker_centers ORDER BY name";
  db.query(sql, (err, centers) => {
	if (err) {
	  console.error(err);
	  return res.status(500).send("Database error");
	}
	res.render("admin/hawker-centers", {
	  title: "Manage Hawker Centers",
	  user: req.session.user,
	  centers,
	  messages: req.flash("success"),
	});
  });

app.get("/hawker-centers/search", checkAuthenticated, (req, res) => {
	const q = req.query.q;
	const sql = "SELECT * FROM hawker_centers WHERE name LIKE ? OR address LIKE ?";
	db.query(sql, [`%${q}%`, `%${q}%`], (err, results) => {
		if (err) throw err;
		res.render("hawker-centers", {
			title: "Search Results - Hawker Hero",
			user: req.session.user,
			centers: results,
			messages: [],
		});
	});
});


});


app.get("admin/hawker-centers/add", checkAuthenticated, checkAdmin, (req, res) => {
	res.render("admin/addHawkerCenter", {
		title: "Add Hawker Center - Hawker Hero",
		user: req.session.user,
	});
});

app.post("admin/hawker-centers/add", checkAuthenticated, checkAdmin, upload.single("image"), (req, res) => {
	const { name, address, facilities } = req.body;
	const image = req.file ? req.file.filename : null;

	const sql = "INSERT INTO hawker_centers (name, address, facilities, image) VALUES (?, ?, ?, ?)";
	db.query(sql, [name, address, facilities, image], (err) => {
		if (err) throw err;
		req.flash("success", "Hawker center added!");
		res.redirect("/hawker-centers");
	});
});

app.get("admin/hawker-centers/edit/:id", checkAuthenticated, checkAdmin, (req, res) => {
	db.query("SELECT * FROM hawker_centers WHERE id = ?", [req.params.id], (err, results) => {
		if (err) throw err;
		if (!results.length) return res.status(404).send("Hawker Center not found");
		res.render("admin/editHawkerCenter", {
			title: "Edit Hawker Center",
			user: req.session.user,
			center: results[0],
		});
	});
});

app.post("admin/hawker-centers/edit/:id", checkAuthenticated, checkAdmin, upload.single("image"), (req, res) => {
	const { name, address, facilities, currentImage } = req.body;
	const image = req.file ? req.file.filename : currentImage;

	const sql = "UPDATE hawker_centers SET name = ?, address = ?, facilities = ?, image = ? WHERE id = ?";
	db.query(sql, [name, address, facilities, image, req.params.id], (err) => {
		if (err) throw err;
		req.flash("success", "Hawker center updated!");
		res.redirect("/hawker-centers");
	});
});

app.get("admin/hawker-centers/delete/:id", checkAuthenticated, checkAdmin, (req, res) => {
	db.query("DELETE FROM hawker_centers WHERE id = ?", [req.params.id], (err) => {
		if (err) throw err;
		req.flash("success", "Hawker center deleted.");
		res.redirect("/hawker-centers");
	});
}); 



app.listen(process.env.PORT || 3000, () => {
	console.log(
		`Server is running on http://localhost:${process.env.PORT || 3000}`
	);
});

console.log('Connecting as MySQL user:', process.env.DB_USER);
