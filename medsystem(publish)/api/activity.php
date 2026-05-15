<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

try {
    $db    = getDB();
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));

    $rows = $db->query("
        SELECT id, type, description, detail, status,
               ts
        FROM activity_log
        ORDER BY ts DESC
        LIMIT {$limit}
    ")->fetchAll();

    echo json_encode($rows);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
