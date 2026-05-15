<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $q = '%' . trim($_GET['q'] ?? '') . '%';
        $stmt = $db->prepare("
            SELECT mr.id,
                   COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown Patient') AS patient,
                   mr.diagnosis, mr.notes,
                   COALESCE(CONCAT('Dr. ', d.last_name), '—') AS doctor,
                   mr.record_date, mr.status, mr.source,
                   mr.patient_id, mr.doctor_id
            FROM medical_records mr
            LEFT JOIN patients p ON p.id = mr.patient_id
            LEFT JOIN doctors d  ON d.id  = mr.doctor_id
            WHERE (p.first_name LIKE ? OR p.last_name LIKE ? OR mr.diagnosis LIKE ?)
               OR mr.patient_id IS NULL
            ORDER BY mr.record_date DESC, mr.created_at DESC
        ");
        $stmt->execute([$q, $q, $q]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if ($method === 'POST') {
        if (empty($body['diagnosis']))  throw new Exception('Diagnosis required.');
        if (empty($body['patient_id'])) throw new Exception('Patient required.');

        $stmt = $db->prepare("
            INSERT INTO medical_records (patient_id, doctor_id, diagnosis, notes, record_date, status, source)
            VALUES (?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            (int)$body['patient_id'],
            $body['doctor_id'] ? (int)$body['doctor_id'] : null,
            trim($body['diagnosis']),
            trim($body['notes'] ?? ''),
            $body['record_date'] ?? date('Y-m-d'),
            $body['status'] ?? 'Pending',
            'manual',
        ]);
        echo json_encode(['message' => 'Record saved.', 'id' => $db->lastInsertId()]);
        exit;
    }

    if ($method === 'PUT') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('ID required.');
        if (empty($body['diagnosis']))  throw new Exception('Diagnosis required.');
        if (empty($body['patient_id'])) throw new Exception('Patient required.');

        $stmt = $db->prepare("
            UPDATE medical_records
            SET patient_id=?, doctor_id=?, diagnosis=?, notes=?, record_date=?, status=?
            WHERE id=?
        ");
        $stmt->execute([
            (int)$body['patient_id'],
            $body['doctor_id'] ? (int)$body['doctor_id'] : null,
            trim($body['diagnosis']),
            trim($body['notes'] ?? ''),
            $body['record_date'] ?? date('Y-m-d'),
            $body['status'] ?? 'Done',
            $id,
        ]);
        echo json_encode(['message' => 'Record updated.']);
        exit;
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('ID required.');
        $db->prepare('DELETE FROM medical_records WHERE id=?')->execute([$id]);
        echo json_encode(['message' => 'Record deleted.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
