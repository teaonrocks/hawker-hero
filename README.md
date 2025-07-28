# Hawker Hero

![Project Status](https://img.shields.io/badge/Status-In%20Progress-blue)

## 🌟 Project Overview

Hawker Hero is a web application designed to help users explore, rate, and recommend Singapore's vibrant hawker stalls. Built with a focus on a youth perspective, it offers comprehensive CRUD (Create, Read, Update, Delete) and search functionalities across various modules, distinguishing access levels between regular users and administrators. The goal is to provide an engaging platform for discovering and sharing insights about Singapore's rich hawker culture.

## ✨ Features

The application is structured into 6 core modules, each managing a specific aspect of hawker culture:

- **Hawker Stalls**: Manage hawker stall listings (name, location, cuisine type).
  - **User Role**: View and Search.
  - **Admin Role**: Full CRUD and Search.
- **Food Items**: Manage food items offered by stalls (name, price, description).
  - **User Role**: View and Search.
  - **Admin Role**: Full CRUD and Search.
- **Ratings & Reviews**: Manage user ratings and reviews for stalls/food (rating, comment).
  - **User Role**: View, Search, Create, Update, Delete.
  - **Admin Role**: Full CRUD and Search.
- **User Recommendations**: Manage user-generated recommendations (must-try items, tips).
  - **User Role**: View, Search, Create, Update, Delete.
  - **Admin Role**: Full CRUD and Search.
- **Hawker Centers**: Manage hawker center locations (name, address, facilities).
  - **User Role**: View and Search.
  - **Admin Role**: Full CRUD and Search.
- **User Favorites**: Manage user favorite stalls/food items (bookmarking system).
  - **User Role**: View, Search, Create, Update, Delete.
  - **Admin Role**: Full CRUD and Search.

**Role-Based Access:**

- **User Role**: Primarily read-only access (can view and search). Specific modules like Reviews, Recommendations, and Favorites allow users to create, update, and delete their _own_ entries.
- **Admin Role**: Full CRUD access across all modules.

## 🚀 Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Templating Engine**: EJS (Embedded JavaScript)
- **Environment Variables**: `dotenv` package for secure configuration management
- **Authentication**: Role-based (User & Admin)

## 📦 Project Structure

```
.
├── config/                            # Configuration files
│   └── database.js                    # Database connection configuration
├── database/                          # Database schema and seed data
│   └── create_db_with_seed_data.sql   # SQL script for database creation and seeding
├── individual/                        # Individual student modules or specific route handlers
│   ├── archer.js
│   ├── casey.js
│   ├── lionel.js
│   ├── nicole.js
│   ├── syaz.js
│   └── trevor.js
├── middleware/                        # Express middleware
│   ├── auth.js                        # Authentication middleware
│   └── validation.js                  # Input validation middleware
├── node_modules/                      # Project dependencies
├── routes/                            # API routes for different modules
│   ├── auth.js                        # Authentication related routes
│   ├── favorites.js                   # Favorite items routes
│   ├── food-items.js                  # Food items routes
│   ├── hawker-centers.js              # Hawker centers routes with CRUD operations
│   ├── recommendations.js             # Recommendation routes
│   ├── reviews.js                     # Review routes
│   └── stalls.js                      # Hawker stall routes
├── utils/                             # Utility functions
│   └── helpers.js                     # Helper functions
├── views/                             # EJS templates for dynamic page rendering
│   ├── admin/                         # Admin-specific views (e.g., dashboard, management)
│   ├── auth/                          # Authentication-related views (e.g., login, register)
│   ├── partials/                      # Reusable EJS partials (headers, footers, common UI elements)
│   ├── addfavorites.ejs               # View for adding favorites
│   ├── addReviews.ejs                 # View for adding reviews
│   ├── dashboard.ejs                  # User dashboard view
│   ├── editComment.ejs                # View for editing comments
│   ├── editfavorites.ejs              # View for editing favorites
│   ├── editReviews.ejs                # View for editing reviews
│   ├── favorites.ejs                  # User favorites list view
│   ├── food-items.ejs                 # List of food items view
│   ├── hawker-centers.ejs             # List of hawker centers view
│   ├── index.ejs                      # Main homepage view
│   ├── recommendations.ejs            # List of recommendations view
│   ├── reviews.ejs                    # List of reviews view
│   ├── stall-detail.ejs               # Detailed view for a single stall
│   ├── stalls-edit.ejs                # View for editing hawker stalls
│   ├── stalls-new.ejs                 # View for adding new hawker stalls
│   ├── stalls.ejs                     # List of hawker stalls view
│   └── users-favorites.ejs            # View displaying users' favorites
├── .env                               # Environment variables (IGNORED by Git)
├── .env.example                       # Template for environment variables
├── .gitignore                         # Specifies intentionally untracked files to ignore
├── app.js                             # Main application entry point and server setup
├── package-lock.json                  # Dependency tree lock file
└── package.json                       # Project metadata and script definitions
```

The `individual/` folder likely contains the specific implementations for the 6 modules, with each `.js` file potentially handled by a different student/developer as part of the team.

## ⚙️ Getting Started

Follow these steps to get your development environment set up and run the application.

### Prerequisites

- Node.js (LTS version recommended)
- npm (comes with Node.js) or Yarn
- MySQL Server

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd hawker-hero
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    # OR
    yarn install
    ```

### Environment Variables

This project uses environment variables to manage sensitive information and configurations.

1.  **Create `.env` file:**
    Copy the `.env.example` file and rename it to `.env` in the root directory of your project.
    ```bash
    cp .env.example .env
    ```
2.  **Configure `.env`:**
    Open the newly created `.env` file and fill in your specific database credentials and other configuration details.

    ```
    # .env
    PORT=3000
    DB_HOST=localhost
    DB_USERNAME=root
    DB_PASSWORD=password
    DB_NAME=database
    ```

    - `PORT`: The port your Express server will listen on.
    - `DB_HOST`: Your MySQL database host (e.g., `localhost`).
    - `DB_USERNAME`: Your MySQL database username.
    - `DB_PASSWORD`: Your MySQL database password.
    - `DB_NAME`: The name of your MySQL database.

    **_SECURITY NOTE_**: **DO NOT** commit your `.env` file to version control. It is already included in `.gitignore` by default.

### Database Setup

1.  **Create MySQL Database and Tables:**
    Ensure your MySQL server is running. You can create the database and all necessary tables, including seed data, by running the provided SQL script.

    **Using MySQL Workbench (Recommended):**

    - Open MySQL Workbench.
    - Connect to your MySQL server.
    - Go to `File > Open SQL Script...`
    - Navigate to your project directory and select the `database/create_db_with_seed_data.sql` file.
    - Once the script is open, click the "Execute (all or selection)" button (the lightning bolt icon) in the toolbar.
    - The script will execute, creating the database and populating it with data. Check the "Output" panel for success messages.

## ▶️ Running the Application

Once everything is set up:

1.  **Start the server:**

    ```bash
    npx nodemon app.js
    ```

    _(Note: You might need to define a "start" script in your `package.json` like `"start": "node app.js"`)_

2.  **Access the application:**
    Open your web browser and navigate to:
    `http://localhost:<PORT>` (e.g., `http://localhost:3000`)

## 🤝 Contributors

This project is a collaborative effort by the following individuals, with specific modules potentially assigned to each:

- Archer
- Casey
- Lionel
- Nicole
- Syaz
- Trevor

_(Feel free to update this section to clarify specific module responsibilities for each person, if known.)_
