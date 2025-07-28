# Hawker Hero

![Project Status](https://img.shields.io/badge/Status-Complete-brightgreen)

## 🌟 Project Overview

Hawker Hero is a comprehensive web application designed to help users explore, rate, and recommend Singapore's vibrant hawker stalls. Built with a focus on community engagement and user experience, it offers full CRUD (Create, Read, Update, Delete) operations, advanced search and filtering capabilities, and role-based access control. The platform provides an engaging way to discover and share insights about Singapore's rich hawker culture.

## ✨ Key Features

### Core Functionality

- **User Authentication**: Secure registration and login system with role-based access (User/Admin)
- **Interactive Dashboard**: Personalized user dashboard with activity timeline and statistics
- **Image Upload**: Support for review and stall images with Multer integration
- **Advanced Search**: Multi-criteria search and filtering across all modules
- **Responsive Design**: Mobile-friendly interface built with Bootstrap 5.3.2

### Module Features

- **Hawker Centers**: Complete management of hawker center locations with facilities information
  - **User Role**: View, search, and filter by location/facilities
  - **Admin Role**: Full CRUD operations with image upload support
- **Hawker Stalls**: Comprehensive stall management with detailed information

  - **User Role**: View and search stalls by various criteria
  - **Admin Role**: Full CRUD operations with center associations

- **Food Items**: Detailed food item catalog with pricing and descriptions

  - **User Role**: View and search food items
  - **Admin Role**: Full CRUD operations with stall associations

- **Reviews & Ratings**: User-generated reviews with ratings and optional images

  - **User Role**: Create, view, edit, and delete own reviews
  - **Admin Role**: Full management of all reviews with moderation capabilities

- **Recommendations**: Community recommendations for must-try items and tips

  - **User Role**: Create, view, edit, and delete own recommendations
  - **Admin Role**: Full management of all recommendations

- **User Favorites**: Personal bookmarking system for stalls and food items
  - **User Role**: Manage personal favorites collection
  - **Admin Role**: Administrative oversight of all user favorites

### Enhanced User Experience

- **Ownership Controls**: Users can only edit/delete their own content (reviews, recommendations, favorites)
- **Real-time Dashboard**: Activity timeline showing recent user actions and contributions
- **Smart Filtering**: Advanced filtering options for better content discovery
- **Flash Messaging**: User-friendly feedback for all actions and operations

## 🚀 Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Templating Engine**: EJS (Embedded JavaScript)
- **Environment Variables**: `dotenv` package for secure configuration management
- **Authentication**: Role-based (User & Admin)

## 📦 Project Structure

```text
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

1. **Start the server:**

   ```bash
   npx nodemon app.js
   ```

   _(Note: You might need to define a "start" script in your `package.json` like `"start": "node app.js"`)_

2. **Access the application:**
   Open your web browser and navigate to:
   `http://localhost:<PORT>` (e.g., `http://localhost:3000`)

## 🔐 User Accounts

The application includes pre-seeded user accounts for testing:

### Admin Account

- **Username**: admin
- **Password**: password
- **Role**: Administrator (full CRUD access to all modules)

### Regular User Account

- **Username**: testuser
- **Password**: password
- **Role**: User (can create/edit own content in reviews, recommendations, and favorites)

## 📱 Application Features

### Dashboard

- Personal activity timeline showing recent actions
- Statistics on user contributions (reviews, recommendations, favorites)
- Quick access to recent content

### Advanced Search & Filtering

- Search across all modules with keyword matching
- Filter by various criteria (ratings, price range, facilities, etc.)
- Sort options for better content discovery

### Image Management

- Upload images for reviews and stall listings
- Automatic image handling with Multer
- Responsive image display in the interface

## 🤝 Contributors

This project is a collaborative effort by the following individuals, with specific modules potentially assigned to each:

- Archer
- Casey
- Lionel
- Nicole
- Syaz
- Trevor

**Note:** Each contributor worked on different aspects of the application development and testing.
