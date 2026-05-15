<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $rows = $db->query("
            SELECT w.id, w.name, w.capacity, w.status,
                   COUNT(p.id) AS occupied
            FROM wards w
            LEFT JOIN patients p ON p.ward_id = w.id AND p.status != 'Discharged'
            GROUP BY w.id
            ORDER BY w.name
        ")->fetchAll();

        foreach ($rows as &$w) {
            $w['occupied']  = (int)$w['occupied'];
            $w['capacity']  = (int)$w['capacity'];
            $w['available'] = max(0, $w['capacity'] - $w['occupied']);
        }
        echo json_encode($rows);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
