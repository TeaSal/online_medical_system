-- schema.sql
CREATE DATABASE IF NOT EXISTS meddb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE meddb;

-- DOCTORS
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  experience INT NOT NULL DEFAULT 0,
  contact VARCHAR(30),
  email VARCHAR(150),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctor_email (email),
  UNIQUE KEY uq_doctor_contact (contact),
  CHECK (experience >= 0)
) ENGINE=InnoDB;

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dob DATE,
  gender ENUM('Male','Female','Other') DEFAULT 'Other',
  contact VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_email (email)
) ENGINE=InnoDB;

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  status ENUM('scheduled','completed','canceled') DEFAULT 'scheduled',
  reason VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (end_datetime > start_datetime),
  INDEX idx_doctor_start (doctor_id, start_datetime),
  INDEX idx_patient_start (patient_id, start_datetime)
) ENGINE=InnoDB;

-- TRIGGER: prevent overlapping appointments for the same doctor (INSERT)
DELIMITER $$
CREATE TRIGGER trg_appointments_no_overlap_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = NEW.doctor_id
      AND a.status <> 'canceled'
      AND NOT (NEW.end_datetime <= a.start_datetime OR NEW.start_datetime >= a.end_datetime)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment clash: doctor already booked for this time';
  END IF;
END$$
DELIMITER ;

-- TRIGGER: prevent overlapping appointments for the same doctor (UPDATE)
DELIMITER $$
CREATE TRIGGER trg_appointments_no_overlap_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = NEW.doctor_id
      AND a.id <> NEW.id
      AND a.status <> 'canceled'
      AND NOT (NEW.end_datetime <= a.start_datetime OR NEW.start_datetime >= a.end_datetime)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment clash: doctor already booked for this time (update)';
  END IF;
END$$
DELIMITER ;

-- BILLS
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appointment_id INT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('pending','paid') DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CHECK (amount >= 0)
) ENGINE=InnoDB;
