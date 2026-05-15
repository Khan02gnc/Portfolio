<?php
require_once __DIR__ . '/includes/auth.php';

// Properly wipe everything
$_SESSION = [];

// Delete the session cookie
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $p['path'], $p['domain'], $p['secure'], $p['httponly']
    );
}

session_destroy();

// Redirect — use JS replace so Back button cannot return to dashboard
header('Content-Type: text/html');
echo '<script>window.location.replace("login.php");</script>';
exit;
