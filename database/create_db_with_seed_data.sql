-- Disable foreign key checks temporarily to allow dropping tables in any order
SET FOREIGN_KEY_CHECKS = 0;

-- Drop database if it exists to ensure a clean start
DROP DATABASE IF EXISTS c237_hawkerhero;

-- Create the database
CREATE DATABASE c237_hawkerhero;

-- Use the newly created database
USE c237_hawkerhero;

-- -----------------------------------------------------
-- Table `users` (Implicit from requirements for FKs like user_id)
-- -----------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- In a real app, store hashed passwords
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Table `hawker_centers`
-- Description: Manage hawker center locations (name, address, facilities, image_url).
-- -----------------------------------------------------
CREATE TABLE hawker_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    facilities TEXT, -- e.g., "Air-conditioned, Toilets, Parking, WiFi"
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Table `stalls`
-- Description: Manage hawker stall listings (name, location, cuisine type, center_id, opening_hours, image_url).
-- -----------------------------------------------------
CREATE TABLE stalls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255), -- Specific unit number or descriptive location within a center
    cuisine_type VARCHAR(100),
    center_id INT, -- FK to hawker_centers
    opening_hours VARCHAR(255),
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES hawker_centers(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- Table `food_items`
-- Description: Manage food items offered by stalls (name, price, description, stall_id, image_url).
-- -----------------------------------------------------
CREATE TABLE food_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    stall_id INT NOT NULL, -- FK to stalls
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- Table `reviews`
-- Description: Manage user ratings and reviews for stalls/food (rating, comment, user_id, stall_id, created_at).
-- -----------------------------------------------------
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- FK to users
    stall_id INT NOT NULL, -- FK to stalls
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- Rating 1-5
    comment TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- Table `recommendations`
-- Description: Manage user-generated recommendations (user_id, stall_id, food_id, tip, created_at).
-- A recommendation can be for a stall or a specific food item.
-- -----------------------------------------------------
CREATE TABLE recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- FK to users
    stall_id INT NOT NULL, -- FK to stalls (A recommendation must be tied to a stall)
    food_id INT, -- FK to food_items (Nullable: for must-try items within a stall, or general stall tips)
    tip TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (food_id) REFERENCES food_items(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- Table `favorites`
-- Description: Manage user favorite stalls/food items (user_id, stall_id, food_id, notes, created_at).
-- A favorite can be for a stall OR a food item, but not necessarily both.
-- The check for at least one of stall_id or food_id present will now be handled at the application level.
-- -----------------------------------------------------
CREATE TABLE favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- FK to users
    stall_id INT, -- FK to stalls (Nullable: can favorite just a food item)
    food_id INT, -- FK to food_items (Nullable: can favorite just a stall)
    notes TEXT, -- Personal notes for the favorite
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (food_id) REFERENCES food_items(id) ON DELETE CASCADE ON UPDATE CASCADE
    -- IMPORTANT: The CHECK constraint "CONSTRAINT chk_favorite_type CHECK (stall_id IS NOT NULL OR food_id IS NOT NULL)"
    -- was removed due to MySQL Error 3823 when combined with ON DELETE CASCADE.
    -- This validation (ensuring at least one of stall_id or food_id is not NULL)
    -- must now be enforced in your Node.js/Express application code
    -- before inserting or updating records in the 'favorites' table.
);

-- -----------------------------------------------------
-- Seed Data
-- -----------------------------------------------------

-- Users
INSERT INTO users (username, email, password_hash, role) VALUES
('johndoe', 'john.doe@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl', 'user'), -- dummy hash
('janedoe', 'jane.doe@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl', 'user'),
('adminuser', 'admin@hawkerhero.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl', 'admin');

-- Hawker Centers
INSERT INTO hawker_centers (name, address, facilities, image_url) VALUES
('Maxwell Food Centre', '1 Kadayanallur St, Singapore 069184', 'Toilets, Seating, Open-air, Variety', 'maxwell-food-centre.jpg'),
('Tiong Bahru Market', '30 Seng Poh Rd, Singapore 168898', 'Toilets, Seating, Wet Market, Iconic', 'tiongbahrumarket.jpg'),
('Old Airport Road Food Centre', '51 Old Airport Rd, Singapore 390051', 'Toilets, Seating, Huge Variety, Parking', 'oldairportroadfoodcenter.jpg');

-- Stalls (linked to Hawker Centers)
INSERT INTO stalls (name, location, cuisine_type, center_id, opening_hours, image_url) VALUES
('Tian Tian Hainanese Chicken Rice', '#01-10/11 Maxwell Food Centre', 'Hainanese', 1, '10:00 AM - 7:00 PM (Closed Mon)', 'tiantianhainanesechickenrice.jpg'),
('Authentic Curry', '#01-05 Tiong Bahru Market', 'Indian', 2, '9:00 AM - 8:00 PM', 'authenticcurry.jpg'),
('Famous Satay', '#01-15 Old Airport Road Food Centre', 'Malay', 3, '11:00 AM - 10:00 PM', 'famoussatay.jpg'),
('Handmade Noodles', '#01-20 Maxwell Food Centre', 'Chinese', 1, '9:30 AM - 6:30 PM', 'homemadenoodles.jpg'),
('Traditional Laksa', '#01-30 Old Airport Road Food Centre', 'Peranakan', 3, '8:00 AM - 5:00 PM', 'traditionallaksa.jpg');

-- Food Items (linked to Stalls)
INSERT INTO food_items (name, price, description, stall_id, image_url) VALUES
('Chicken Rice Set', 5.50, 'Steamed chicken with fragrant rice and chili sauce.', 1, 'chickenrice.jpg'),
('Curry Chicken', 7.00, 'Rich and spicy chicken curry with potatoes.', 2, 'currychicken.jpg'),
('Mutton Satay (10 sticks)', 8.00, 'Grilled mutton skewers with peanut sauce.', 3, 'muttonsatay.jpg'),
('Fishball Noodles', 4.00, 'Springy noodles with fishballs and minced meat.', 4, 'fishballnoodles.jpg'),
('Katong Laksa', 6.50, 'Spicy coconut milk-based noodle soup with prawns and fish cake.', 5, 'laksa.jpg'),
('Roasted Pork Rice', 6.00, 'Crispy roasted pork served with rice and dark sauce.', 1, 'roastedpork.jpg');

-- Reviews
INSERT INTO reviews (user_id, stall_id, rating, comment, image_url) VALUES
(1, 1, 5, 'The best chicken rice in Singapore! Long queue but worth it.', 'review_chicken_rice_1.jpg'),
(2, 3, 4, 'Great satay, very smoky. Peanut sauce is on point!', 'review_satay_1.jpg'),
(1, 4, 3, 'Decent fishball noodles, soup could be richer.', NULL),
(3, 5, 5, 'Authentic Katong Laksa, loved the rich broth and fresh ingredients.', 'review_laksa_1.jpg'),
(2, 1, 4, 'Always a classic, consistent quality. A must-try for tourists.', NULL),
(1, 2, 5, 'Fantastic curry! The spices are just right, not overly spicy.', 'review_curry_1.jpg');

-- Recommendations
INSERT INTO recommendations (user_id, stall_id, food_id, tip) VALUES
(1, 1, 1, 'Must try the chicken rice! It lives up to the hype.'),
(2, 3, 3, 'Order extra peanut sauce for the satay, it\'s addictive!'),
(1, 5, 5, 'If you love spicy food, the Katong Laksa here is a definite must-try. Ask for extra chili!'),
(3, 1, 6, 'Their roasted pork is surprisingly good too, crispy skin!'),
(2, 4, NULL, 'Come early before lunch rush, it gets crowded fast.'),
(3, 2, 2, 'Pair the curry chicken with a crispy prata for the best experience.');


-- Favorites
INSERT INTO favorites (user_id, stall_id, food_id, notes) VALUES
(1, 1, NULL, 'My all-time favorite chicken rice stall.'),
(1, NULL, 5, 'Best laksa in town!'),
(2, 3, NULL, 'Favourite place for supper satay.'),
(3, 4, 4, 'My go-to comfort food. Always satisfies.'),
(3, 1, 1, 'John recommended this, it was excellent.'),
(2, 2, 2, 'My weekly dose of Indian curry, so good.');


-- Enable foreign key checks again
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Database and tables created with seed data successfully!' AS Status;

-- Optional: Verify data by selecting from tables
-- SELECT * FROM users;
-- SELECT * FROM hawker_centers;
-- SELECT * FROM stalls;
-- SELECT * FROM food_items;
-- SELECT * FROM reviews;
-- SELECT * FROM recommendations;
-- SELECT * FROM favorites;

-- -----------------------------------------------------
-- Table `comments`
-- Description: Store comments made by users on reviews.
-- -----------------------------------------------------
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,      -- FK to reviews table
    user_id INT NOT NULL,        -- FK to users table
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);