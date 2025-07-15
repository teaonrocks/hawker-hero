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
├── individual/ # Individual student modules or specific route handlers
│ ├── archer.js
│ ├── casey.js
│ ├── lionel.js
│ ├── nicole.js
│ ├── syaz.js
│ └── trevor.js
├── node_modules/ # Project dependencies
├── public/ # Static assets (CSS, client-side JS, images)
│ ├── css/
│ └── js/
├── views/ # EJS templates for dynamic page rendering
│ └── index.ejs
├── .env # Environment variables (IGNORED by Git)
├── .env.example # Template for environment variables
├── app.js # Main application entry point and server setup
├── package-lock.json # Dependency tree lock file
└── package.json # Project metadata and script definitions
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
    HOST=localhost
    USERNAME=root
    PASSWORD=password
    DATABASE=database
    ```

    - `PORT`: The port your Express server will listen on.
    - `HOST`: Your MySQL database host (e.g., `localhost`).
    - `USERNAME`: Your MySQL database username.
    - `PASSWORD`: Your MySQL database password.
    - `DATABASE`: The name of your MySQL database.

    **_SECURITY NOTE_**: **DO NOT** commit your `.env` file to version control. It is already included in `.gitignore` by default.

<!-- ### Database Setup

1.  **Create MySQL Database:**
    Ensure your MySQL server is running. Create a database with the name specified in your `.env` file (e.g., `c237_studentlistapp`).
    ```sql
    CREATE DATABASE c237_studentlistapp;
    USE c237_studentlistapp;
    ```
2.  **Run Migrations/Schema (if available):**
    You will need to create the tables defined in the project requirements (`stalls`, `food_items`, `reviews`, `recommendations`, `hawker_centers`, `favorites`). If there are SQL schema files (e.g., `.sql` files in a `database/` or `migrations/` folder), execute them to set up your tables.
    - _(Self-note: Add instructions here if you create actual SQL migration scripts.)_ -->

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
