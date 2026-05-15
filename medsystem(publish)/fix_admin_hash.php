<?php
// ============================================================
//  fix_admin_hash.php — Run ONCE, then DELETE this file!
//  Visit: http://localhost/medsystem/fix_admin_hash.php
//  Resets admin password to: medsystem
// ============================================================
require_once __DIR__ . '/includes/db.php';

$password = 'medsystem';
$hash     = password_hash($password, PASSWORD_DEFAULT);

$db   = getDB();
$stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE username = ?');
$stmt->execute([$hash, 'admin']);

echo '<style>body{font-family:sans-serif;padding:40px;max-width:500px;margin:auto;}</style>';

if ($stmt->rowCount()) {
    echo '
    <h2 style="color:#16a34a;">✅ Password Reset Successful</h2>
    <p>Admin password has been set to: <strong>medsystem</strong></p>
    <p><a href="login.php" style="color:#2563eb;">→ Go to login page</a></p>
    <hr>
    <p style="color:#dc2626;font-weight:bold;">⚠️ Delete this file immediately after use!</p>
    ';
} else {
    echo '
    <h2 style="color:#dc2626;">❌ No admin user found</h2>
    <p>Make sure the users table exists and has username = admin.</p>
    ';
}