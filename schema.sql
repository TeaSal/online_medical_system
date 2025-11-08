CREATE DATABASE IF NOT EXISTS meddb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE meddb;

-- =====================
-- DOCTORS
-- =====================
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  experience INT NOT NULL DEFAULT 0,
  contact VARCHAR(30),
  email VARCHAR(150),
  bio TEXT,
  photo_url VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctor_email (email),
  UNIQUE KEY uq_doctor_contact (contact),
  CHECK (experience >= 0)
) ENGINE=InnoDB;

-- =====================
-- PATIENTS
-- =====================
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dob DATE,
  gender ENUM('Male','Female','Other') DEFAULT 'Other',
  contact VARCHAR(30),
  email VARCHAR(150) UNIQUE,
  address TEXT,
  password VARCHAR(150) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================
-- APPOINTMENTS
-- =====================
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

-- =====================
-- FAVORITES
-- =====================
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  doctor_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fav (user_id, doctor_id),
  FOREIGN KEY (user_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================
-- BILLS
-- =====================
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

-- =====================
-- TRIGGERS
-- =====================

-- prevent overlapping appointments (INSERT)
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

-- prevent overlapping appointments (UPDATE)
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

-- =====================
-- SAMPLE DATA
-- =====================
INSERT INTO doctors (name, department, experience, contact, email, bio, photo_url)
VALUES 
('Dr. Asha Rao','Cardiology',8,'+91-9876543210','asha.rao@example.com','Expert in cardiac care.','https://randomuser.me/api/portraits/women/44.jpg'),
('Dr. Rahul Mehra','General Medicine',5,'+91-9123456780','rahul.mehra@example.com','Specialist in internal medicine.','https://randomuser.me/api/portraits/men/45.jpg'),
('Dr. Olivia Turner','Dermatology',15,'+91-9001122334','olivia.turner@example.com','Skin and endocrine disorders specialist.','https://randomuser.me/api/portraits/women/46.jpg'),
('Dr. Arjun Kapoor','Neurology',10,'+91-9002233445','arjun.kapoor@example.com','Focused on brain and nervous system disorders.','https://randomuser.me/api/portraits/men/47.jpg');

INSERT INTO patients (name, dob, gender, contact, email, address, password)
VALUES 
('Tiya Singh','2004-06-12','Female','+91-9000001111','tiya.singh@example.com','Delhi','123456'),
('Ankit Verma','2003-09-07','Male','+91-9000002222','ankit.verma@example.com','Noida','123456'),
('Simran Kaur','2002-01-20','Female','+91-9000003333','simran.kaur@example.com','Gurgaon','123456');

-- Appointments (30 min slots)
INSERT INTO appointments (patient_id, doctor_id, start_datetime, end_datetime, reason)
VALUES 
(1, 1, '2025-09-28 10:00:00', '2025-09-28 10:30:00', 'Cardiac checkup'),
(2, 2, '2025-09-29 11:00:00', '2025-09-29 11:30:00', 'General fever'),
(3, 3, '2025-09-30 14:00:00', '2025-09-30 14:30:00', 'Skin allergy');

-- Bills
INSERT INTO bills (patient_id, appointment_id, amount, status)
VALUES 
(1, 1, 500.00, 'pending'),
(2, 2, 300.00, 'paid');

-- Favorites
INSERT INTO favorites (user_id, doctor_id)
VALUES (1, 3), (2, 1);
