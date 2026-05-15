<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Pending count for badge
        if (isset($_GET['pending_count'])) {
            $count = $db->query("SELECT COUNT(*) FROM appointments WHERE status='Pending'")->fetchColumn();
            echo json_encode(['count' => (int)$count]);
            exit;
        }

        $q      = '%' . trim($_GET['q'] ?? '') . '%';
        $date   = $_GET['date']   ?? '';
        $status = $_GET['status'] ?? '';

        $where  = ['1=1'];
        $params = [];

        if (trim($_GET['q'] ?? '') !== '') {
            $where[]  = '(a.patient_name LIKE ? OR d.first_name LIKE ? OR d.last_name LIKE ?)';
            $params   = array_merge($params, [$q, $q, $q]);
        }
        if ($date) {
            $where[]  = 'a.appointment_date = ?';
            $params[] = $date;
        }
        if ($status) {
            $where[]  = 'a.status = ?';
            $params[] = $status;
        }

        // Patients only see their own
        if (!isAdmin()) {
            $uid      = $_SESSION['user_id'];
            $where[]  = 'a.user_id = ?';
            $params[] = $uid;
        }

        $sql = "
            SELECT a.id, a.patient_name, a.appointment_date AS date,
                   DATE_FORMAT(a.appointment_date,'%b %d, %Y') AS date_fmt,
                   a.appointment_time AS time, a.type, a.status, a.notes,
                   a.doctor_id, a.department_id, a.rejection_reason,
                   CONCAT('Dr. ', d.last_name) AS doctor,
                   dep.name AS department
            FROM appointments a
            LEFT JOIN doctors d ON d.id = a.doctor_id
            LEFT JOIN departments dep ON dep.id = a.department_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY a.appointment_date DESC, a.appointment_time ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // POST — create
    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['patient_name'])) throw new Exception('Patient name required.');
        if (empty($body['date']))         throw new Exception('Date required.');
        if (empty($body['time']))         throw new Exception('Time required.');

        $uid = $_SESSION['user_id'] ?? null;

        $stmt = $db->prepare("
            INSERT INTO appointments
                (user_id, patient_name, doctor_id, department_id,
                 appointment_date, appointment_time, type, status, notes)
            VALUES (?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $uid,
            trim($body['patient_name']),
            $body['doctor_id']     ?: null,
            $body['department_id'] ?: null,
            $body['date'],
            $body['time'],
            $body['type']   ?? 'Consultation',
            $body['status'] ?? 'Scheduled',
            trim($body['notes'] ?? ''),
        ]);
        echo json_encode(['message' => 'Appointment saved.', 'id' => $db->lastInsertId()]);
        exit;
    }

    // PUT — update
    if ($method === 'PUT') {
        requireAdmin();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['id'])) throw new Exception('ID required.');

        $stmt = $db->prepare("
            UPDATE appointments SET
                patient_name=?, doctor_id=?, department_id=?,
                appointment_date=?, appointment_time=?, type=?, status=?, notes=?
            WHERE id=?
        ");
        $stmt->execute([
            trim($body['patient_name']),
            $body['doctor_id']     ?: null,
            $body['department_id'] ?: null,
            $body['date'],
            $body['time'],
            $body['type']   ?? 'Consultation',
            $body['status'] ?? 'Scheduled',
            trim($body['notes'] ?? ''),
            (int)$body['id'],
        ]);
        echo json_encode(['message' => 'Appointment updated.']);
        exit;
    }

    // DELETE
    if ($method === 'DELETE') {
        requireAdmin();
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('ID required.');
        $db->prepare('DELETE FROM appointments WHERE id=?')->execute([$id]);
        echo json_encode(['message' => 'Appointment deleted.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
