-- Run this on your existing database to fix the approve bug
-- Error: Column 'description' cannot be null when patient_id is NULL

DROP TRIGGER IF EXISTS trg_after_record_insert;

DELIMITER $$
CREATE TRIGGER trg_after_record_insert
AFTER INSERT ON medical_records FOR EACH ROW
BEGIN
    INSERT INTO activity_log (type, description, detail, status, ts)
    VALUES (
        'record',
        CONCAT('Medical record added — Patient #', COALESCE(NEW.patient_id, 'Unknown')),
        COALESCE(NEW.diagnosis, 'No diagnosis'),
        'Done',
        NOW()
    );
END$$
DELIMITER ;
