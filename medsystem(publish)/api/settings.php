<?php
require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db.php';
requireLogin();

$user   = currentUser();
$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

// ── GET: fetch current settings ────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT full_name, email, phone, role FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();
    if (!$row) { jsonResponse(['error' => 'User not found'], 404); }
    // Merge with session prefs (stored as JSON in session)
    $prefs = $_SESSION['prefs'] ?? [];
    jsonResponse([
        'full_name'     => $row['full_name'] ?? '',
        'email'         => $row['email']     ?? '',
        'phone'         => $row['phone']     ?? '',
        'role'          => $row['role']      ?? '',
        'theme'         => $prefs['theme']         ?? 'light',
        'language'      => $prefs['language']      ?? 'en',
        'notif_email'   => $prefs['notif_email']   ?? true,
        'notif_sms'     => $prefs['notif_sms']     ?? false,
        'notif_appt'    => $prefs['notif_appt']    ?? true,
        'notif_updates' => $prefs['notif_updates'] ?? false,
    ]);
}

// ── POST actions ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// ── update_profile ─────────────────────────────────────────────
if ($action === 'update_profile') {
    $name  = trim($body['full_name'] ?? '');
    $email = trim($body['email']     ?? '');
    $phone = trim($body['phone']     ?? '');

    if ($name === '') { jsonResponse(['error' => 'Name is required'], 400); }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Invalid email address'], 400);
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('UPDATE users SET full_name=?, email=?, phone=? WHERE id=?');
    $stmt->execute([$name, $email, $phone, $userId]);

    // Refresh session
    $_SESSION['user']['full_name'] = $name;
    $_SESSION['user']['email']     = $email;
    $_SESSION['user']['phone']     = $phone;

    jsonResponse(['ok' => true, 'full_name' => $name]);
}

// ── change_password ────────────────────────────────────────────
if ($action === 'change_password') {
    $current = $body['current_password'] ?? '';
    $newPw   = $body['new_password']     ?? '';
    $confirm = $body['confirm_password'] ?? '';

    if (strlen($newPw) < 6) {
        jsonResponse(['error' => 'New password must be at least 6 characters'], 400);
    }
    if ($newPw !== $confirm) {
        jsonResponse(['error' => 'New passwords do not match'], 400);
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    if (!$row || !password_verify($current, $row['password_hash'])) {
        jsonResponse(['error' => 'Current password is incorrect'], 400);
    }

    $hash = password_hash($newPw, PASSWORD_BCRYPT);
    $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash, $userId]);

    jsonResponse(['ok' => true]);
}

// ── save_prefs ─────────────────────────────────────────────────
if ($action === 'save_prefs') {
    $allowed = ['theme','language','notif_email','notif_sms','notif_appt','notif_updates'];
    $prefs   = $_SESSION['prefs'] ?? [];
    foreach ($allowed as $k) {
        if (array_key_exists($k, $body)) {
            $prefs[$k] = $body[$k];
        }
    }
    $_SESSION['prefs'] = $prefs;
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unknown action'], 400);
