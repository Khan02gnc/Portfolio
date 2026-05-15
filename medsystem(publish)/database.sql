-- ============================================================
--  MedSystem Hospital Management Database (FIXED)
-- ============================================================
CREATE DATABASE IF NOT EXISTS medsystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medsystem;

-- ------------------------------------------------------------
-- Users (login)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(30),
    date_of_birth DATE,
    sex ENUM('Male','Female','Other'),
    address TEXT,
    role ENUM('admin','doctor','nurse','receptionist','patient') DEFAULT 'patient',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, username, password_hash, full_name, role) VALUES
    (1, 'Medsystem',   '$2y$12$96yn0GCJ6W6u3MAJvtdlm.AlFcHgxvRz8vjDRj4q7nOQLzmI4FYtu', 'Administrator', 'admin'),
    (2, 'jaycelesis',  '$2y$12$KIx6PqBvYtN1QwZ3RmD4uOeHsLjF7gXcAkVpTnYbMoW5dCrEiU8Sa', 'Jayce Lesis',   'patient');

-- ------------------------------------------------------------
-- Departments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO departments (name) VALUES
    ('General Medicine'),
    ('Pediatrics'),
    ('Surgery'),
    ('Emergency'),
    ('Cardiology'),
    ('Maternity');

-- ------------------------------------------------------------
-- Wards
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 10,
    status ENUM('Normal','Monitored','Full') DEFAULT 'Normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO wards (name, capacity, status) VALUES
    ('Ward A — General',   16, 'Normal'),
    ('Ward B — Maternity', 12, 'Normal'),
    ('Ward C — Pediatrics',10, 'Normal'),
    ('ICU',                 8, 'Normal');

-- ------------------------------------------------------------
-- Doctors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department_id INT,
    year_started YEAR,
    status ENUM('On duty','Off duty','In surgery','On leave') DEFAULT 'On duty',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

INSERT INTO doctors (first_name, last_name, department_id, year_started, status) VALUES
    ('J.', 'Lesis',     1, 2018, 'On duty'),
    ('J.', 'Celestial', 2, 2020, 'On duty'),
    ('K.', 'Santos',    3, 2015, 'In surgery'),
    ('L.', 'Sinque',    4, 2019, 'On duty'),
    ('R.', 'Lopez',     5, 2016, 'Off duty'),
    ('K.', 'Calma',     5, 2014, 'On duty'),
    ('C.', 'Castro',    5, 2021, 'Off duty'),
    ('S.', 'Manalac',   5, 2022, 'In surgery');

-- ------------------------------------------------------------
-- Patients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    sex ENUM('Male','Female','Other') DEFAULT 'Female',
    address TEXT,
    ward_id INT,
    doctor_id INT,
    condition_summary VARCHAR(255),
    status ENUM('Admitted','Critical','Recovering','Discharged','Pending') DEFAULT 'Admitted',
    admitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discharged_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (ward_id)   REFERENCES wards(id)   ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Appointments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    rejection_reason VARCHAR(255) NULL,
    patient_name VARCHAR(200) NOT NULL,
    doctor_id INT,
    department_id INT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    type ENUM('Consultation','Follow-up','Checkup','Emergency','Pre-op','Prenatal') DEFAULT 'Consultation',
    status ENUM('Scheduled','Pending','Done','Urgent','Cancelled','Rejected') DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by)    REFERENCES users(id)        ON DELETE SET NULL,
    FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE SET NULL,
    FOREIGN KEY (department_id)  REFERENCES departments(id)  ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Medical Records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    doctor_id INT,
    diagnosis TEXT NOT NULL,
    notes TEXT,
    record_date DATE NOT NULL,
    status ENUM('Pending','Done') DEFAULT 'Pending',
    source ENUM('manual','patient_admitted','appointment') DEFAULT 'manual',
    appointment_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Activity Log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('appointment','patient','record') NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail VARCHAR(255),
    status VARCHAR(50),
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: new appointment
DELIMITER $$
CREATE TRIGGER trg_after_appointment_insert
AFTER INSERT ON appointments FOR EACH ROW
BEGIN
    INSERT INTO activity_log (type, description, detail, status, ts)
    VALUES (
        'appointment',
        CONCAT('New appointment — ', NEW.patient_name),
        CONCAT('Status: ', NEW.status),
        NEW.status,
        NEW.created_at
    );
END$$

-- Trigger: appointment status updated
CREATE TRIGGER trg_after_appointment_update
AFTER UPDATE ON appointments FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO activity_log (type, description, detail, status, ts)
        VALUES (
            'appointment',
            CONCAT('Appointment updated — ', NEW.patient_name),
            CONCAT('Status changed to: ', NEW.status),
            NEW.status,
            NOW()
        );
    END IF;
END$$

-- Trigger: new patient admitted
CREATE TRIGGER trg_after_patient_insert
AFTER INSERT ON patients FOR EACH ROW
BEGIN
    INSERT INTO activity_log (type, description, detail, status, ts)
    VALUES (
        'patient',
        CONCAT('Patient admitted — ', NEW.first_name, ' ', NEW.last_name),
        CONCAT('Status: ', NEW.status),
        NEW.status,
        NEW.admitted_at
    );
END$$

-- Trigger: patient status updated
CREATE TRIGGER trg_after_patient_update
AFTER UPDATE ON patients FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO activity_log (type, description, detail, status, ts)
        VALUES (
            'patient',
            CONCAT('Patient updated — ', NEW.first_name, ' ', NEW.last_name),
            CONCAT('Status changed to: ', NEW.status),
            NEW.status,
            NOW()
        );
    END IF;
END$$

-- Trigger: new medical record
CREATE TRIGGER trg_after_record_insert
AFTER INSERT ON medical_records FOR EACH ROW
BEGIN
    INSERT INTO activity_log (type, description, detail, status, ts)
    VALUES (
        'record',
        CONCAT('Medical record added — Patient #', NEW.patient_id),
        NEW.diagnosis,
        'Done',
        NEW.created_at
    );
END$$