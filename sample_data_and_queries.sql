USE meddb;

-- sample data
INSERT INTO doctors (name, department, experience, contact, email)
VALUES ('Dr. Asha Rao','Cardiology',8,'+91-9876543210','asha.rao@example.com'),
       ('Dr. Rahul Mehra','General Medicine',5,'+91-9123456780','rahul.mehra@example.com');
       ('Dr. Nia Allina','Dermatology',3,'+91-91234512345','nia.allina@example.com');

INSERT INTO patients (name, dob, gender, contact, email, address)
VALUES ('Tiya Singh','2004-06-12','Female','+91-9000001111','tiya.singh@example.com','Delhi'),
       ('Ankit Verma','2003-09-07','Male','+91-9000002222','ankit.verma@example.com','Noida');

-- schedule an appointment (30 min slot)
INSERT INTO appointments (patient_id, doctor_id, start_datetime, end_datetime, reason)
VALUES (1, 1, '2025-09-28 10:00:00', '2025-09-28 10:30:00', 'Checkup');

-- create bill for appointment
INSERT INTO bills (patient_id, appointment_id, amount, status)
VALUES (1, 1, 500.00, 'pending');

-- sample queries
-- 1. List today's appointments for a doctor
SELECT a.id, p.name AS patient, a.start_datetime, a.end_datetime, a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.id
WHERE a.doctor_id = 1
  AND DATE(a.start_datetime) = CURDATE()
ORDER BY a.start_datetime;

-- 2. Appointment clash check (useful in app too)
SELECT COUNT(*) AS overlapping
FROM appointments a
WHERE a.doctor_id = 1
  AND a.status <> 'canceled'
  AND NOT ('2025-09-28 10:00:00' >= a.end_datetime OR '2025-09-28 09:00:00' <= a.start_datetime);

-- 3. Patient billing summary
SELECT p.name, SUM(b.amount) AS total_due
FROM patients p
LEFT JOIN bills b ON p.id = b.patient_id AND b.status = 'pending'
GROUP BY p.id;

-- 4. View upcoming appointments (next 7 days)
SELECT a.id, d.name AS doctor, p.name AS patient, a.start_datetime, a.status
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
JOIN patients p ON a.patient_id = p.id
WHERE a.start_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
ORDER BY a.start_datetime;

-- 5. Simple stored procedure to create billing (demo)
DELIMITER $$
CREATE PROCEDURE sp_create_bill_for_appointment(IN appt_id INT, IN amt DECIMAL(10,2))
BEGIN
  DECLARE pid INT;
  SELECT patient_id INTO pid FROM appointments WHERE id = appt_id;
  IF pid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid appointment id';
  ELSE
    INSERT INTO bills (patient_id, appointment_id, amount, status) VALUES (pid, appt_id, amt, 'pending');
  END IF;
END$$
DELIMITER ;
