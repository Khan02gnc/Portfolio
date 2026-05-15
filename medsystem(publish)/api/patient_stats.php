<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db = getDB();

    // Total: ALL patients regardless of status
    $total = (int)$db->query('SELECT COUNT(*) FROM patients')->fetchColumn();

    // New this month: admitted this month
    $newMonth = (int)$db->query("
        SELECT COUNT(*) FROM patients
        WHERE MONTH(admitted_at) = MONTH(CURDATE())
          AND YEAR(admitted_at)  = YEAR(CURDATE())
    ")->fetchColumn();

    // Need follow-up: Recovering OR Pending status
    $followup = (int)$db->query("
        SELECT COUNT(*) FROM patients
        WHERE status IN ('Recovering', 'Pending')
    ")->fetchColumn();

    // Appointments today: any non-cancelled/rejected appointment today
    $aptsToday = (int)$db->query("
        SELECT COUNT(*) FROM appointments
        WHERE appointment_date = CURDATE()
          AND status NOT IN ('Cancelled','Rejected')
    ")->fetchColumn();

    echo json_encode([
        'total'      => $total,
        'new_month'  => $newMonth,
        'followup'   => $followup,
        'apts_today' => $aptsToday,
    ]);

} catch (Exception $e) {
    echo json_encode(['total'=>0,'new_month'=>0,'followup'=>0,'apts_today'=>0,'error'=>$e->getMessage()]);
}
