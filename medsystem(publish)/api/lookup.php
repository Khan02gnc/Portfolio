<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db = getDB();

    $doctors = $db->query("
        SELECT d.id,
               CONCAT('Dr. ', d.first_name, ' ', d.last_name) AS name,
               dep.name AS department
        FROM doctors d
        LEFT JOIN departments dep ON dep.id = d.department_id
        ORDER BY d.last_name
    ")->fetchAll();

    $departments = $db->query("
        SELECT id, name FROM departments ORDER BY name
    ")->fetchAll();

    $wards = $db->query("
        SELECT w.id, w.name,
               (w.capacity - COUNT(p.id)) AS available
        FROM wards w
        LEFT JOIN patients p ON p.ward_id = w.id AND p.status != 'Discharged'
        GROUP BY w.id
        ORDER BY w.name
    ")->fetchAll();

    $patients = $db->query("
        SELECT id,
               CONCAT(first_name, ' ', last_name) AS name
        FROM patients
        WHERE status != 'Discharged'
        ORDER BY last_name
    ")->fetchAll();

    echo json_encode(compact('doctors', 'departments', 'wards', 'patients'));

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
