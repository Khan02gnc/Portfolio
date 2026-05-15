<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db = getDB();

    $total = (int)$db->query('SELECT COUNT(*) FROM doctors')->fetchColumn();

    $depts = $db->query("
        SELECT dep.name AS department, COUNT(d.id) AS count
        FROM departments dep
        LEFT JOIN doctors d ON d.department_id = dep.id
        GROUP BY dep.id, dep.name
        ORDER BY dep.name
    ")->fetchAll();

    echo json_encode([
        'total'       => $total,
        'departments' => $depts,
    ]);

} catch (Exception $e) {
    echo json_encode(['total' => 0, 'departments' => []]);
}
