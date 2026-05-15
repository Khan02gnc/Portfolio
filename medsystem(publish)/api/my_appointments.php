<?php
/**
 * api/my_appointments.php
 * Patient-facing appointments endpoint used by portal.js
 *
 * GET    → returns all appointments for the logged-in patient
 * POST   → books a new appointment (patient_name auto-filled from session)
 * DELETE ?id=N → cancels own appointment
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
requireLogin();
header('Content-Type: application/json');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$uid    = $_SESSION['user_id'];
$user   = currentUser();

try {

    /* ── GET — list this patient's appointments ─────────────────── */
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT  a.id,
                    a.patient_name,
                    a.appointment_date  AS date,
                    DATE_FORMAT(a.appointment_date,'%b %d, %Y') AS date_fmt,
                    a.appointment_time  AS time,
                    a.type,
                    a.status,
                    a.notes,
                    a.doctor_id,
                    a.department_id,
                    a.rejection_reason,
                    CONCAT('Dr. ', d.last_name)  AS doctor,
                    dep.name                     AS department
            FROM  appointments a
            LEFT JOIN doctors     d   ON d.id  = a.doctor_id
            LEFT JOIN departments dep ON dep.id = a.department_id
            WHERE a.user_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time ASC
        ");
        $stmt->execute([$uid]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    /* ── POST — book a new appointment ──────────────────────────── */
    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Use the session full_name as patient_name (patients book for themselves)
        $patientName = trim($user['full_name'] ?? '');
        if ($patientName === '') {
            throw new Exception('Could not determine patient name. Please log out and back in.');
        }

        if (empty($body['date']))     throw new Exception('Date required.');
        if (empty($body['time']))     throw new Exception('Time required.');
        if (empty($body['doctor_id'])) throw new Exception('Please select a doctor.');

        $stmt = $db->prepare("
            INSERT INTO appointments
                (user_id, patient_name, doctor_id, department_id,
                 appointment_date, appointment_time, type, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
        ");
        $stmt->execute([
            $uid,
            $patientName,
            (int)$body['doctor_id'],
            !empty($body['department_id']) ? (int)$body['department_id'] : null,
            $body['date'],
            $body['time'],
            $body['type'] ?? 'Consultation',
            trim($body['notes'] ?? ''),
        ]);

        echo json_encode([
            'message' => 'Appointment request submitted.',
            'id'      => (int)$db->lastInsertId(),
        ]);
        exit;
    }

    /* ── DELETE — cancel own appointment ────────────────────────── */
    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) throw new Exception('Appointment ID required.');

        // Ensure this appointment belongs to the logged-in patient
        $appt = $db->prepare("SELECT id, status FROM appointments WHERE id = ? AND user_id = ?");
        $appt->execute([$id, $uid]);
        $row = $appt->fetch(PDO::FETCH_ASSOC);

        if (!$row) throw new Exception('Appointment not found.');
        if (!in_array($row['status'], ['Pending', 'Scheduled'])) {
            throw new Exception('Only Pending or Scheduled appointments can be cancelled.');
        }

        $db->prepare("UPDATE appointments SET status = 'Cancelled' WHERE id = ?")
           ->execute([$id]);

        echo json_encode(['message' => 'Appointment cancelled.']);
        exit;
    }

    throw new Exception('Method not allowed.');

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
