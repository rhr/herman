-- MySQL database setup script for Herman

-- Create database
CREATE DATABASE IF NOT EXISTS herman_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (change password in production!)
CREATE USER IF NOT EXISTS 'herman_user'@'localhost' IDENTIFIED BY 'gizmo';

-- Grant privileges
GRANT ALL PRIVILEGES ON herman_db.* TO 'herman_user'@'localhost';
FLUSH PRIVILEGES;

-- Use the database
USE herman_db;

-- Show confirmation
SELECT 'Database setup completed successfully!' AS status;
