<?php
require_once __DIR__ . '/../includes/auth.php';

if (!isLoggedIn()) {
    jsonResponse(['logged_in' => false], 401);
}

jsonResponse(['logged_in' => true, 'role' => ($_SESSION['user']['role'] ?? '')]);
