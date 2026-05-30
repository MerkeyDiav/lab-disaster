-- AWS Disaster Recovery Lab - Database Schema
-- This script creates the todos table for the application

-- Create database (if you need to create it manually)
-- CREATE DATABASE tododb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index on created_at for faster queries
CREATE INDEX idx_created_at ON todos(created_at);

-- Optional: Insert sample data for testing
-- INSERT INTO todos (title) VALUES ('Sample task 1');
-- INSERT INTO todos (title) VALUES ('Sample task 2');
