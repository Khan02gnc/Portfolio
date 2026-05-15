-- ============================================================
--  MedSystem — Migration: Patient User Accounts
--  Run this if you already have the base database.
--  Safe to run multiple times (uses IF NOT EXISTS / ALTER IGNORE).
-- ============================================================
USE medsystem;

-- 1. Add 'patient' role to users table
ALTER TABLE users MODIFY COLUMN role ENUM('admin','doctor','nurse','receptionist','patient') DEFAULT 'admin';

-- 2. Add user_id link to appointments (so we know which patient submitted it)
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id,
    ADD COLUMN IF NOT EXISTS reviewed_by INT NULL AFTER user_id,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL AFTER reviewed_by,
    ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255) NULL AFTER reviewed_at;

-- 3. Add 'Rejected' to appointment status
ALTER TABLE appointments MODIFY COLUMN status
    ENUM('Scheduled','Pending','Done','Urgent','Cancelled','Rejected') DEFAULT 'Scheduled';

-- Foreign keys (ignore error if already exists)
ALTER TABLE appointments
    ADD CONSTRAINT fk_apt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
--  Migration: Medical Records Auto-Creation
--  Adds status + source columns to track record origin
-- ============================================================

-- 4. Add status and source to medical_records
ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS status ENUM('Pending','Done') DEFAULT 'Pending' AFTER record_date,
    ADD COLUMN IF NOT EXISTS source ENUM('manual','patient_admitted','appointment') DEFAULT 'manual' AFTER status,
    ADD COLUMN IF NOT EXISTS appointment_id INT NULL AFTER source;

ALTER TABLE medical_records
    ADD CONSTRAINT fk_rec_apt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
