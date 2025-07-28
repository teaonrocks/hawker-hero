const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { queryDB } = require("../utils/helpers");
const { checkAuthenticated, checkAdmin } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

// Setup Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {

    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// GET /food-items (with optional filters)
router.get("/food-items", async (req, res) => {
  const filters = {
    name: req.query.name || "",
    minPrice: req.query.minPrice || "",
    maxPrice: req.query.maxPrice || "",
    stall: req.query.stall || "", // stall filter
  };

  try {
    let sql = `
      SELECT fi.id, fi.name, fi.price, fi.description, fi.stall_id, fi.image_url, s.name AS stall_name
      FROM food_items fi
      JOIN stalls s ON fi.stall_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.name) {
      sql += " AND fi.name LIKE ?";
      params.push(`%${filters.name}%`);
    }

    if (filters.minPrice) {
      sql += " AND fi.price >= ?";
      params.push(parseFloat(filters.minPrice));
    }

    if (filters.maxPrice) {
      sql += " AND fi.price <= ?";
      params.push(parseFloat(filters.maxPrice));
    }

    if (filters.stall) {
      sql += " AND fi.stall_id = ?";
      params.push(parseInt(filters.stall));
    }

    const foodItems = await queryDB(sql, params);
    const stalls = await queryDB("SELECT id, name FROM stalls ORDER BY name ASC");

    res.render("food-items", {
      title: "Food Items - Hawker Hero",
      user: req.session.user,
      messages: req.flash("success"),
      errors: req.flash("error"),
      foodItems,
      stalls,
      filters,
    });
  } catch (err) {
    console.error("Error loading food items:", err);
    req.flash("error", "Failed to load food items.");
    res.render("food-items", {
      title: "Food Items - Hawker Hero",
      user: req.session.user,
      messages: [],
      errors: [],
      foodItems: [],
      stalls: [],
      filters,
    });
  }
});

// POST /food-items/add
router.post(
  "/food-items/add",
  checkAuthenticated,
  checkAdmin,
  upload.single("image"),
  async (req, res) => {
    const { name, price, description, stall_id } = req.body;
    const image_url = req.file ? req.file.filename : null;

    if (!name || !price || !stall_id) {
      req.flash("error", "Name, Price, and Stall are required to add a food item.");
      return res.redirect("/food-items");
    }

    try {
      const insertSql = `
        INSERT INTO food_items (name, price, description, stall_id, image_url, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      await queryDB(insertSql, [
        name,
        parseFloat(price),
        description || null,
        stall_id,
        image_url,
      ]);

      req.flash("success", "Food item added successfully!");
      res.redirect("/food-items");
    } catch (err) {
      console.error("Database error adding food item:", err);
      req.flash("error", "Failed to add food item. Please try again.");
      res.redirect("/food-items");
    }
  }
);

// POST /food-items/edit/:id
router.post(
  "/food-items/edit/:id",
  checkAuthenticated,
  checkAdmin,
  upload.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { name, price, description, stall_id } = req.body;
    const image_url = req.file ? req.file.filename : null;

    if (!name || !price || !stall_id) {
      req.flash("error", "Name, Price, and Stall are required to update a food item.");
      return res.redirect("/food-items");
    }

    try {
      let updateSql, params;

      if (image_url) {
        updateSql = `
          UPDATE food_items
          SET name = ?, price = ?, description = ?, stall_id = ?, image_url = ?
          WHERE id = ?
        `;
        params = [name, parseFloat(price), description || null, stall_id, image_url, id];
      } else {
        updateSql = `
          UPDATE food_items
          SET name = ?, price = ?, description = ?, stall_id = ?
          WHERE id = ?
        `;
        params = [name, parseFloat(price), description || null, stall_id, id];
      }

      await queryDB(updateSql, params);

      req.flash("success", "Food item updated successfully!");
      res.redirect("/food-items");
    } catch (err) {
      console.error("Database error updating food item:", err);
      req.flash("error", "Failed to update food item. Please try again.");
      res.redirect("/food-items");
    }
  }
);

// POST /food-items/delete/:id
router.post(
  "/food-items/delete/:id",
  checkAuthenticated,
  checkAdmin,
  async (req, res) => {
    const { id } = req.params;

    try {
      const deleteSql = "DELETE FROM food_items WHERE id = ?";
      await queryDB(deleteSql, [id]);

      req.flash("success", "Food item deleted successfully!");
      res.redirect("/food-items");
    } catch (err) {
      console.error("Database error deleting food item:", err);
      req.flash("error", "Failed to delete food item. Please try again.");
      res.redirect("/food-items");
    }
  }
);



module.exports = router;
