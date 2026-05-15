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

        // Check if phone column exists (safe fallback if migration not yet run)
        $hasPhone = false;
        try {
            $db->query("SELECT phone FROM patients LIMIT 1");
            $hasPhone = true;
        } catch (Exception $e) {
            $hasPhone = false;
        }
        $phoneCol = $hasPhone ? 'p.phone,' : "''" . ' AS phone,';

        $stmt = $db->prepare("
            SELECT p.id, p.first_name, p.last_name,
                   CONCAT(p.first_name, ' ', p.last_name) AS name,
                   CASE 
                     WHEN p.date_of_birth IS NULL THEN NULL
                     WHEN TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) < 0 THEN NULL
                     ELSE TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE())
                   END AS age,
                   p.date_of_birth, p.sex, {$phoneCol} p.address,
                   p.condition_summary AS `condition`,
                   p.status, p.ward_id, p.doctor_id,
                   w.name AS ward,
                   CONCAT('Dr. ', d.last_name) AS doctor,
                   p.admitted_at
            FROM patients p
            LEFT JOIN wards w ON w.id = p.ward_id
            LEFT JOIN doctors d ON d.id = p.doctor_id
            WHERE p.first_name LIKE ? OR p.last_name LIKE ?
               OR p.condition_summary LIKE ? OR w.name LIKE ?
            ORDER BY p.admitted_at DESC
        ");
        $stmt->execute([$q, $q, $q, $q]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if ($method === 'POST') {
        if (empty($body['first_name']) || empty($body['last_name']))
            throw new Exception('First and last name are required.');

        // Validate date of birth — must not be in the future
        if (!empty($body['date_of_birth'])) {
            $dob = DateTime::createFromFormat('Y-m-d', $body['date_of_birth']);
            if (!$dob || $dob > new DateTime('today'))
                throw new Exception('Date of birth cannot be in the future.');
        }

        // Check if phone column exists
        $hasPhone = false;
        try { $db->query("SELECT phone FROM patients LIMIT 1"); $hasPhone = true; } catch (Exception $e) {}

        if ($hasPhone) {
            $stmt = $db->prepare("
                INSERT INTO patients (first_name, last_name, date_of_birth, sex, phone, address,
                                      ward_id, doctor_id, condition_summary, status)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['phone'] ?? ''), trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $body['status'] ?? 'Admitted',
            ]);
        } else {
            $stmt = $db->prepare("
                INSERT INTO patients (first_name, last_name, date_of_birth, sex, address,
                                      ward_id, doctor_id, condition_summary, status)
                VALUES (?,?,?,?,?,?,?,?,?)
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $body['status'] ?? 'Admitted',
            ]);
        }
        $patientId = $db->lastInsertId();

        // Auto-create a Pending medical record upon admission
        $diagnosis = trim($body['condition'] ?? '') ?: 'Pending — awaiting diagnosis';
        $recStmt = $db->prepare("
            INSERT INTO medical_records (patient_id, doctor_id, diagnosis, notes, record_date, status, source)
            VALUES (?, ?, ?, ?, CURDATE(), 'Pending', 'patient_admitted')
        ");
        $recStmt->execute([
            $patientId,
            $body['doctor_id'] ?: null,
            $diagnosis,
            'Auto-created upon patient admission.',
        ]);

        echo json_encode(['message' => 'Patient added.', 'id' => $patientId]);
        exit;
    }

    if ($method === 'PUT') {
        if (empty($body['id'])) throw new Exception('ID required.');

        if (!empty($body['date_of_birth'])) {
            $dob = DateTime::createFromFormat('Y-m-d', $body['date_of_birth']);
            if (!$dob || $dob > new DateTime('today'))
                throw new Exception('Date of birth cannot be in the future.');
        }
        // Check if phone column exists
        $hasPhone = false;
        try { $db->query("SELECT phone FROM patients LIMIT 1"); $hasPhone = true; } catch (Exception $e) {}

        $newStatus = $body['status'] ?? 'Admitted';

        // Check if discharged_at column exists
        $hasDischargedAt = false;
        try { $db->query("SELECT discharged_at FROM patients LIMIT 1"); $hasDischargedAt = true; } catch (Exception $e) {}

        if ($hasPhone && $hasDischargedAt) {
            $stmt = $db->prepare("
                UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, sex=?,
                    phone=?, address=?, ward_id=?, doctor_id=?, condition_summary=?, status=?,
                    discharged_at=IF(? = 'Discharged' AND (discharged_at IS NULL), NOW(), discharged_at)
                WHERE id=?
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['phone'] ?? ''), trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $newStatus,
                $newStatus, (int)$body['id'],
            ]);
        } elseif ($hasPhone) {
            $stmt = $db->prepare("
                UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, sex=?,
                    phone=?, address=?, ward_id=?, doctor_id=?, condition_summary=?, status=?
                WHERE id=?
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['phone'] ?? ''), trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $newStatus,
                (int)$body['id'],
            ]);
        } elseif ($hasDischargedAt) {
            $stmt = $db->prepare("
                UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, sex=?,
                    address=?, ward_id=?, doctor_id=?, condition_summary=?, status=?,
                    discharged_at=IF(? = 'Discharged' AND (discharged_at IS NULL), NOW(), discharged_at)
                WHERE id=?
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $newStatus,
                $newStatus, (int)$body['id'],
            ]);
        } else {
            $stmt = $db->prepare("
                UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, sex=?,
                    address=?, ward_id=?, doctor_id=?, condition_summary=?, status=?
                WHERE id=?
            ");
            $stmt->execute([
                trim($body['first_name']), trim($body['last_name']),
                $body['date_of_birth'] ?: null, $body['sex'] ?? 'Female',
                trim($body['address'] ?? ''),
                $body['ward_id'] ?: null, $body['doctor_id'] ?: null,
                trim($body['condition'] ?? ''), $newStatus,
                (int)$body['id'],
            ]);
        }
        echo json_encode(['message' => 'Patient updated.']);
        exit;
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('ID required.');
        $db->prepare('DELETE FROM patients WHERE id=?')->execute([$id]);
        echo json_encode(['message' => 'Patient deleted.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
