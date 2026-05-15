<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db = getDB();

    $stats = [];

    // Total counts
    $stats['total_patients'] = (int)$db->query('SELECT COUNT(*) FROM patients WHERE status != "Discharged"')->fetchColumn();
    $stats['total_doctors']  = (int)$db->query('SELECT COUNT(*) FROM doctors WHERE status = "On duty"')->fetchColumn();

    // Beds available
    $bedRow = $db->query('
        SELECT COALESCE(SUM(w.capacity), 0) AS total,
               COUNT(p.id) AS occupied
        FROM wards w
        LEFT JOIN patients p ON p.ward_id = w.id AND p.status != "Discharged"
    ')->fetch();
    $stats['beds_available'] = $bedRow ? max(0, (int)$bedRow['total'] - (int)$bedRow['occupied']) : 0;
    $stats['beds_occupied']  = $bedRow ? (int)$bedRow['occupied'] : 0;

    // Patient section stats
    $stats['patients_new_this_month'] = (int)$db->query("
        SELECT COUNT(*) FROM patients
        WHERE MONTH(admitted_at) = MONTH(CURDATE())
          AND YEAR(admitted_at)  = YEAR(CURDATE())
    ")->fetchColumn();

    $stats['patients_need_followup'] = (int)$db->query("
        SELECT COUNT(*) FROM patients WHERE status = 'Recovering'
    ")->fetchColumn();

    $stats['appointments_today'] = (int)$db->query("
        SELECT COUNT(*) FROM appointments
        WHERE status NOT IN ('Cancelled','Rejected')
    ")->fetchColumn();

    $stats['appointments_pending'] = (int)$db->query("
        SELECT COUNT(*) FROM appointments WHERE status = 'Pending'
    ")->fetchColumn();

    // Weekly admitted vs discharged — last 7 days
    $weekRows = $db->query("
        SELECT 
            DAYNAME(admitted_at) AS day_name,
            DAYOFWEEK(admitted_at) AS day_num,
            DATE(admitted_at) AS day_date,
            SUM(CASE WHEN status != 'Discharged' THEN 1 ELSE 0 END) AS admitted,
            SUM(CASE WHEN status = 'Discharged' THEN 1 ELSE 0 END) AS discharged
        FROM patients
        WHERE admitted_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(admitted_at), DAYNAME(admitted_at), DAYOFWEEK(admitted_at)
        ORDER BY day_date ASC
    ")->fetchAll(PDO::FETCH_ASSOC);
    $stats['weekly_patients'] = $weekRows;

    // Department load — count appointments per department (excluding Cancelled/Rejected)
    $deptRows = $db->query("
        SELECT dep.name AS department, COUNT(a.id) AS total
        FROM appointments a
        JOIN departments dep ON dep.id = a.department_id
        WHERE a.status NOT IN ('Cancelled','Rejected')
        GROUP BY dep.id, dep.name
        ORDER BY total DESC
    ")->fetchAll(PDO::FETCH_ASSOC);
    $stats['department_load'] = $deptRows;

    echo json_encode($stats);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
