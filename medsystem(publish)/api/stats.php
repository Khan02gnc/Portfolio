<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db = getDB();
    $stats = [];

    $stats['total_patients'] = (int)$db->query('SELECT COUNT(*) FROM patients WHERE status != "Discharged"')->fetchColumn();
    $stats['total_doctors']  = (int)$db->query('SELECT COUNT(*) FROM doctors WHERE status = "On duty"')->fetchColumn();

    $stats['appointments_today'] = (int)$db->query("
        SELECT COUNT(*) FROM appointments
        WHERE status NOT IN ('Cancelled','Rejected')
    ")->fetchColumn();

    $stats['appointments_pending'] = (int)$db->query("
        SELECT COUNT(*) FROM appointments WHERE status = 'Pending'
    ")->fetchColumn();

    $bedRow = $db->query('
        SELECT COALESCE(SUM(w.capacity), 0) AS total, COUNT(p.id) AS occupied
        FROM wards w
        LEFT JOIN patients p ON p.ward_id = w.id AND p.status != "Discharged"
    ')->fetch();
    $stats['beds_available'] = $bedRow ? max(0, (int)$bedRow['total'] - (int)$bedRow['occupied']) : 0;
    $stats['beds_occupied']  = $bedRow ? (int)$bedRow['occupied'] : 0;

    $stats['patients_new_this_month'] = (int)$db->query("
        SELECT COUNT(*) FROM patients
        WHERE MONTH(admitted_at) = MONTH(CURDATE()) AND YEAR(admitted_at) = YEAR(CURDATE())
    ")->fetchColumn();

    $stats['patients_need_followup'] = (int)$db->query("
        SELECT COUNT(*) FROM patients WHERE status = 'Recovering'
    ")->fetchColumn();

    // Check if discharged_at column exists
    $hasDischargedAt = false;
    try {
        $db->query("SELECT discharged_at FROM patients LIMIT 1");
        $hasDischargedAt = true;
    } catch (Exception $e) {
        $hasDischargedAt = false;
    }

    // Admitted per day — last 7 days
    $admittedRows = $db->query("
        SELECT DATE(admitted_at) AS day_date, COUNT(*) AS cnt
        FROM patients
        WHERE DATE(admitted_at) >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(admitted_at)
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Discharged per day — use discharged_at if available, else fallback
    if ($hasDischargedAt) {
        $dischargedRows = $db->query("
            SELECT DATE(discharged_at) AS day_date, COUNT(*) AS cnt
            FROM patients
            WHERE discharged_at IS NOT NULL
              AND DATE(discharged_at) >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(discharged_at)
        ")->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Fallback: treat admitted_at as discharge date for discharged patients
        $dischargedRows = $db->query("
            SELECT DATE(admitted_at) AS day_date, COUNT(*) AS cnt
            FROM patients
            WHERE status = 'Discharged'
              AND DATE(admitted_at) >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(admitted_at)
        ")->fetchAll(PDO::FETCH_ASSOC);
    }

    $admittedMap   = array_column($admittedRows,   'cnt', 'day_date');
    $dischargedMap = array_column($dischargedRows,  'cnt', 'day_date');

    $weekRows = [];
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-{$i} days"));
        $weekRows[] = [
            'day_date'   => $date,
            'admitted'   => (int)($admittedMap[$date]   ?? 0),
            'discharged' => (int)($dischargedMap[$date] ?? 0),
        ];
    }
    $stats['weekly_patients'] = $weekRows;

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
