<?php
// ============================================================
//  Database Configuration
//  Edit these values to match your server setup
// ============================================================
define('DB_HOST', 'sql102.infinityfree.com');
define('DB_NAME', 'if0_41914748_medsystem');
define('DB_USER', 'if0_41914748');
define('DB_PASS', 'adminmedsystem');
define('DB_CHAR', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=3306;dbname=' . DB_NAME . ';charset=' . DB_CHAR;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}
