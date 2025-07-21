function checkFavoriteOwnershipOrAdmin(req, res, next) {
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
}

// List all favorites (everyone can see)
app.get("/favorites", checkAuthenticated, (req, res) => {
  const sql = `
    SELECT 
      f.id, f.notes, f.created_at,
      u.username,
      s.id AS stall_id, s.name AS stall_name,
      fd.id AS food_id, fd.name AS food_name
    FROM favorites f
    JOIN users u ON f.user_id = u.id
    LEFT JOIN stalls s ON f.stall_id = s.id
    LEFT JOIN food_items fd ON f.food_id = fd.id
    ORDER BY f.created_at DESC`;

  db.query(sql, (err, favorites) => {
    if (err) return res.status(500).send("Database error");
    res.render("favorites", {   // <-- fixed here
      title: "All Favorites",
      user: req.session.user,
      favorites,
      messages: req.flash("success"),
    });
  });
});

// Add favorite (POST)
app.post("/favorites/add", checkAuthenticated, (req, res) => {
  const { stall_id, food_id, notes } = req.body;
  const user_id = req.session.user.id;

  const checkSql = "SELECT * FROM favorites WHERE user_id = ? AND stall_id = ? AND food_id = ?";
  db.query(checkSql, [user_id, stall_id, food_id], (err, results) => {
    if (err) return res.status(500).send("Database error");
    if (results.length > 0) {
      req.flash("success", "Already in favorites!");
      return res.redirect("back");
    }

    const insertSql = `
      INSERT INTO favorites (user_id, stall_id, food_id, notes, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    db.query(insertSql, [user_id, stall_id || null, food_id || null, notes || null], (err) => {
      if (err) return res.status(500).send("Database error");
      req.flash("success", "Added to favorites!");
      res.redirect("back");
    });
  });
});

// Edit favorite form (GET)
app.get("/favorites/edit/:id", checkAuthenticated, checkFavoriteOwnershipOrAdmin, (req, res) => {
  const sql = `
    SELECT f.id, f.notes, f.stall_id, f.food_id, s.name AS stall_name, fd.name AS food_name
    FROM favorites f
    LEFT JOIN stalls s ON f.stall_id = s.id
    LEFT JOIN food_items fd ON f.food_id = fd.id
    WHERE f.id = ?`;

  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).send("Database error");
    if (!results.length) return res.status(404).send("Favorite not found");

    res.render("editFavorite", {  // <-- fixed here
      title: "Edit Favorite",
      user: req.session.user,
      favorite: results[0],
    });
  });
});

// Edit favorite submit (POST)
app.post("/favorites/edit/:id", checkAuthenticated, checkFavoriteOwnershipOrAdmin, (req, res) => {
  const { stall_id, food_id, notes } = req.body;

  const sql = `
    UPDATE favorites
    SET stall_id = ?, food_id = ?, notes = ?, created_at = NOW()
    WHERE id = ?`;

  db.query(sql, [stall_id || null, food_id || null, notes || null, req.params.id], (err) => {
    if (err) return res.status(500).send("Database error");
    req.flash("success", "Favorite updated!");
    res.redirect("/favorites");
  });
});

// Delete favorite
app.get("/favorites/delete/:id", checkAuthenticated, checkFavoriteOwnershipOrAdmin, (req, res) => {
  const favoriteId = req.params.id;
  const sql = "DELETE FROM favorites WHERE id = ?";
  db.query(sql, [favoriteId], (err) => {
    if (err) return res.status(500).send("Database error");
    req.flash("success", "Favorite removed.");
    res.redirect("/favorites");
  });
});