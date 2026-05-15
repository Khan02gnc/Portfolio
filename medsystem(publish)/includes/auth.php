<?php
// ============================================================
//  Auth helpers
// ============================================================
session_start();

// ── Prevent browser from caching protected pages ─────────────
// This ensures that pressing the Back button will NOT show a
// cached version of a page the user has already left.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
// ─────────────────────────────────────────────────────────────

function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

function isAdmin(): bool {
    return ($_SESSION['user']['role'] ?? '') === 'admin';
}

function isPatient(): bool {
    return ($_SESSION['user']['role'] ?? '') === 'patient';
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

function requireAdmin(): void {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
    if (!isAdmin()) {
        // Logged in but not admin — send to patient portal
        header('Location: portal.php');
        exit;
    }
}

function requirePatient(): void {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
    if (!isPatient()) {
        // Logged in but not patient (e.g. admin) — send to admin dashboard
        header('Location: index.php');
        exit;
    }
}

function currentUser(): array {
    return $_SESSION['user'] ?? [];
}

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function sanitize(string $val): string {
    return htmlspecialchars(trim($val), ENT_QUOTES, 'UTF-8');
}