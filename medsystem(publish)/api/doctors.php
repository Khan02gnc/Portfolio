<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    // GET — list doctors
    if ($method === 'GET') {
        $q     = '%' . trim($_GET['q'] ?? '') . '%';
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 200;

        $stmt = $db->prepare("
            SELECT d.id, d.first_name, d.last_name,
                   CONCAT(d.first_name, ' ', d.last_name) AS full_name,
                   CONCAT(d.first_name, ' ', d.last_name) AS name,
                   dep.id AS department_id, dep.name AS department,
                   d.year_started, d.status,
                   COUNT(p.id) AS patient_count,
                   CONCAT(UPPER(LEFT(d.first_name,1)), UPPER(LEFT(d.last_name,1))) AS initials
            FROM doctors d
            LEFT JOIN departments dep ON dep.id = d.department_id
            LEFT JOIN patients p ON p.doctor_id = d.id AND p.status != 'Discharged'
            WHERE d.first_name LIKE ? OR d.last_name LIKE ? OR dep.name LIKE ?
            GROUP BY d.id
            ORDER BY d.last_name
            LIMIT {$limit}
        ");
        $stmt->execute([$q, $q, $q]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // POST — create doctor
    if ($method === 'POST') {
        if (empty($body['first_name']) || empty($body['last_name']))
            throw new Exception('First and last name are required.');

        $stmt = $db->prepare("
            INSERT INTO doctors (first_name, last_name, department_id, year_started, status)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            trim($body['first_name']),
            trim($body['last_name']),
            $body['department_id'] ?: null,
            $body['year_started']  ?: null,
            $body['status'] ?? 'On duty',
        ]);
        echo json_encode(['message' => 'Doctor added.', 'id' => $db->lastInsertId()]);
        exit;
    }

    // PUT — update doctor
    if ($method === 'PUT') {
        if (empty($body['id'])) throw new Exception('ID required.');
        $stmt = $db->prepare("
            UPDATE doctors SET first_name=?, last_name=?, department_id=?, year_started=?, status=?
            WHERE id=?
        ");
        $stmt->execute([
            trim($body['first_name']),
            trim($body['last_name']),
            $body['department_id'] ?: null,
            $body['year_started']  ?: null,
            $body['status'] ?? 'On duty',
            (int)$body['id'],
        ]);
        echo json_encode(['message' => 'Doctor updated.']);
        exit;
    }

    // DELETE
    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('ID required.');
        $db->prepare('DELETE FROM doctors WHERE id=?')->execute([$id]);
        echo json_encode(['message' => 'Doctor deleted.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
