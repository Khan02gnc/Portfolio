<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireAdmin();
header('Content-Type: application/json');

try {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $id     = (int)($body['id']     ?? 0);
    $action = $body['action'] ?? '';

    if (!$id)     throw new Exception('Appointment ID required.');
    if (!$action) throw new Exception('Action required.');

    $db  = getDB();
    $uid = $_SESSION['user_id'];

    if ($action === 'approve') {
        $stmt = $db->prepare("
            UPDATE appointments
            SET status='Scheduled', reviewed_by=?, reviewed_at=NOW()
            WHERE id=? AND status='Pending'
        ");
        $stmt->execute([$uid, $id]);
        if ($stmt->rowCount() === 0)
            throw new Exception('Appointment not found or already reviewed.');

        // Fetch appointment + user info
        $apt = $db->prepare("
            SELECT a.patient_name, a.doctor_id, a.appointment_date, a.type, a.user_id,
                   u.full_name, u.sex, u.date_of_birth, u.address
            FROM appointments a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.id = ?
        ");
        $apt->execute([$id]);
        $aptRow = $apt->fetch();

        $apptUserId  = $aptRow['user_id'];
        $patientName = $aptRow['patient_name'] ?? $aptRow['full_name'] ?? 'Unknown';
        $apptType    = $aptRow['type'] ?? 'Consultation';

        // Step 1: Find existing patient record linked to this user
        $patientId = null;
        if ($apptUserId) {
            $pStmt = $db->prepare("SELECT id FROM patients WHERE user_id = ? LIMIT 1");
            $pStmt->execute([$apptUserId]);
            $pRow = $pStmt->fetch();
            if ($pRow) $patientId = $pRow['id'];
        }

        // Step 2: If no patient record exists, auto-create one
        if (!$patientId) {
            $nameParts = explode(' ', trim($patientName));
            $firstName = $nameParts[0] ?? $patientName;
            $lastName  = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '—';

            $createPatient = $db->prepare("
                INSERT INTO patients (first_name, last_name, sex, date_of_birth, address, status, user_id, admitted_at)
                VALUES (?, ?, ?, ?, ?, 'Admitted', ?, NOW())
            ");
            $createPatient->execute([
                $firstName,
                $lastName,
                $aptRow['sex'] ?? 'Other',
                $aptRow['date_of_birth'] ?: null,
                $aptRow['address'] ?? '',
                $apptUserId,
            ]);
            $patientId = (int)$db->lastInsertId();
        }

        // Step 3: Create medical record
        $recStmt = $db->prepare("
            INSERT INTO medical_records (patient_id, doctor_id, diagnosis, notes, record_date, status, source, appointment_id)
            VALUES (?, ?, ?, ?, ?, 'Pending', 'appointment', ?)
        ");
        $recStmt->execute([
            $patientId,
            $aptRow['doctor_id'] ?: null,
            'Pending — ' . $apptType . ' appointment',
            'Patient: ' . $patientName . '. Auto-created on appointment approval.',
            $aptRow['appointment_date'] ?? date('Y-m-d'),
            $id,
        ]);

        echo json_encode(['message' => 'Appointment approved.']);

    } elseif ($action === 'reject') {
        $reason = trim($body['reason'] ?? '');
        $stmt   = $db->prepare("
            UPDATE appointments
            SET status='Rejected', reviewed_by=?, reviewed_at=NOW(), rejection_reason=?
            WHERE id=? AND status='Pending'
        ");
        $stmt->execute([$uid, $reason ?: null, $id]);
        if ($stmt->rowCount() === 0)
            throw new Exception('Appointment not found or already reviewed.');
        echo json_encode(['message' => 'Appointment rejected.']);

    } else {
        throw new Exception('Unknown action.');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
