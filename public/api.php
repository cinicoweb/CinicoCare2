<?php
/**
 * CinicoCare - Backend API con Database Testuale JSON per Hosting Aruba
 * Autore: Nicola Cirillo (c) 2026
 * 
 * Questo script permette la sincronizzazione centralizzata in tempo reale tra tutti i dispositivi
 * (PC, smartphone Android, iPhone, tablet) salvando i dati in un file JSON protetto sul server.
 */

// Impostazioni CORS e Headers HTTP
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Gestione richieste pre-flight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Percorsi di archiviazione
$dataDir = __DIR__ . '/data';
$dbFile = $dataDir . '/database.json';
$htaccessFile = $dataDir . '/.htaccess';

// Creazione automatica della cartella dati e protezione .htaccess
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

if (!file_exists($htaccessFile)) {
    $htaccessContent = "# Protezione del database testuale CinicoCare\n<IfModule !mod_authz_core.c>\n  Order deny,allow\n  Deny from all\n</IfModule>\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
    @file_put_contents($htaccessFile, $htaccessContent);
}

// Struttura iniziale predefinita del database
function getInitialDatabase() {
    return [
        'users' => [
            [
                'id' => 'user_superadmin_01',
                'email' => 'admin@cinicocare.it',
                'name' => 'Amministratore Generale',
                'phone' => '',
                'role' => 'superadmin',
                'familyId' => null,
                'assignedPatientIds' => [],
                'isFamilyAdmin' => true,
                'gdprAccepted' => true,
                'gdprAcceptedAt' => '2026-01-01T00:00:00.000Z',
                'passwordHash' => 'Adm10870@!',
                'createdAt' => '2026-01-01T00:00:00.000Z'
            ]
        ],
        'families' => [],
        'patients' => [],
        'therapies' => [],
        'doseLogs' => [],
        'invitations' => [],
        'pushSubscriptions' => []
    ];
}

// Funzioni di lettura e scrittura sicura con file locking (flock)
function readDatabase($dbFile) {
    if (!file_exists($dbFile)) {
        $initial = getInitialDatabase();
        writeDatabase($dbFile, $initial);
        return $initial;
    }

    $fp = fopen($dbFile, 'r');
    if (!$fp) {
        return getInitialDatabase();
    }

    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $db = json_decode($content, true);
    if (!is_array($db)) {
        $db = getInitialDatabase();
    }

    if (!isset($db['users']) || !is_array($db['users'])) $db['users'] = [];
    if (!isset($db['families']) || !is_array($db['families'])) $db['families'] = [];
    if (!isset($db['patients']) || !is_array($db['patients'])) $db['patients'] = [];
    if (!isset($db['therapies']) || !is_array($db['therapies'])) $db['therapies'] = [];
    if (!isset($db['doseLogs']) || !is_array($db['doseLogs'])) $db['doseLogs'] = [];
    if (!isset($db['invitations']) || !is_array($db['invitations'])) $db['invitations'] = [];

    // Garantisce la presenza dell'account admin predefinito se non presente
    $hasAdmin = false;
    foreach ($db['users'] as $u) {
        if (strtolower($u['email']) === 'admin@cinicocare.it') {
            $hasAdmin = true;
            break;
        }
    }
    if (!$hasAdmin) {
        $init = getInitialDatabase();
        $db['users'][] = $init['users'][0];
        writeDatabase($dbFile, $db);
    }

    return $db;
}

function writeDatabase($dbFile, $data) {
    $fp = fopen($dbFile, 'c+');
    if (!$fp) {
        throw new Exception('Impossibile aprire il file di database per la scrittura. Verifica i permessi della cartella data.');
    }

    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    } else {
        fclose($fp);
        throw new Exception('Impossibile acquisire il blocco esclusivo sul database.');
    }
}

// Funzioni di utilità per autenticazione tramite Token
function getAuthToken() {
    $headers = apache_request_headers_custom();
    if (isset($headers['Authorization'])) {
        $auth = trim($headers['Authorization']);
        if (strpos($auth, 'Bearer ') === 0) {
            return substr($auth, 7);
        }
    }
    if (isset($_GET['token'])) {
        return $_GET['token'];
    }
    return null;
}

function apache_request_headers_custom() {
    $arh = [];
    $rx_http = '/\AHTTP_/';
    foreach ($_SERVER as $key => $val) {
        if (preg_match($rx_http, $key)) {
            $arh_key = preg_replace($rx_http, '', $key);
            $rx_matches = explode('_', $arh_key);
            if (count($rx_matches) > 0 and strlen($arh_key) > 2) {
                foreach ($rx_matches as $ak_key => $ak_val) {
                    $rx_matches[$ak_key] = ucfirst(strtolower($ak_val));
                }
                $arh_key = implode('-', $rx_matches);
            }
            $arh[$arh_key] = $val;
        }
    }
    if (isset($_SERVER['CONTENT_TYPE'])) $arh['Content-Type'] = $_SERVER['CONTENT_TYPE'];
    if (isset($_SERVER['CONTENT_LENGTH'])) $arh['Content-Length'] = $_SERVER['CONTENT_LENGTH'];
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) $arh['Authorization'] = $_SERVER['HTTP_AUTHORIZATION'];
    return $arh;
}

function getAuthenticatedUser($db) {
    $token = getAuthToken();
    if (!$token) return null;

    // Token format: token_{userId}_{timestamp} or local_token_{userId}_{timestamp}
    $parts = explode('_', $token);
    if (count($parts) >= 2) {
        $userId = $parts[1];
        if ($parts[0] === 'local' && isset($parts[2])) {
            $userId = $parts[2];
        }
        foreach ($db['users'] as $u) {
            if ($u['id'] === $userId) {
                return $u;
            }
        }
    }
    return null;
}

function sanitizeUser($user) {
    if (!$user) return null;
    unset($user['passwordHash']);
    return $user;
}

// Parsing azione richiesta
$action = isset($_GET['action']) ? trim($_GET['action'], '/') : '';
if (!$action && isset($_SERVER['PATH_INFO'])) {
    $action = trim($_SERVER['PATH_INFO'], '/');
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = readDatabase($dbFile);

    // ROUTE: Health / Ping
    if ($action === 'health' || $action === 'ping') {
        echo json_encode([
            'status' => 'ok',
            'server' => 'CinicoCare PHP Text-Database Engine',
            'timestamp' => date('c'),
            'totalUsers' => count($db['users']),
            'totalFamilies' => count($db['families'])
        ]);
        exit();
    }

    // ROUTE: Auth Login
    if ($action === 'auth/login' && $method === 'POST') {
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        $matched = null;
        foreach ($db['users'] as $u) {
            if (strtolower(trim($u['email'])) === $email) {
                $matched = $u;
                break;
            }
        }

        if (!$matched) {
            http_response_code(401);
            echo json_encode(['error' => 'Credenziali non valide: utente non trovato']);
            exit();
        }

        if ($matched['passwordHash'] !== $password) {
            http_response_code(401);
            echo json_encode(['error' => 'Password errata']);
            exit();
        }

        $token = 'token_' . $matched['id'] . '_' . time();
        echo json_encode([
            'user' => sanitizeUser($matched),
            'token' => $token
        ]);
        exit();
    }

    // ROUTE: Auth Register
    if ($action === 'auth/register' && $method === 'POST') {
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        $name = trim($input['name'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $familyName = trim($input['familyName'] ?? '');
        $invitationToken = trim($input['invitationToken'] ?? '');
        $gdprAccepted = (bool)($input['gdprAccepted'] ?? false);

        if (!$email || !$password || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Compila tutti i campi obbligatori (Nome, Email, Password)']);
            exit();
        }

        foreach ($db['users'] as $u) {
            if (strtolower(trim($u['email'])) === $email) {
                http_response_code(400);
                echo json_encode(['error' => 'Email già registrata. Effettua il login o usa un\'altra email.']);
                exit();
            }
        }

        $userId = 'user_' . time() . '_' . rand(100, 999);
        $now = date('c');

        if ($invitationToken) {
            $invIdx = -1;
            foreach ($db['invitations'] as $idx => $inv) {
                if ($inv['token'] === $invitationToken && $inv['status'] === 'pending') {
                    $invIdx = $idx;
                    break;
                }
            }

            if ($invIdx === -1) {
                http_response_code(400);
                echo json_encode(['error' => 'Link d\'invito non valido o già utilizzato']);
                exit();
            }

            $inv = $db['invitations'][$invIdx];
            $newUser = [
                'id' => $userId,
                'email' => $email,
                'name' => $name,
                'phone' => $phone,
                'role' => $inv['role'],
                'familyId' => $inv['familyId'],
                'assignedPatientIds' => $inv['assignedPatientIds'] ?? [],
                'isFamilyAdmin' => ($inv['role'] === 'familiare'),
                'gdprAccepted' => $gdprAccepted,
                'gdprAcceptedAt' => $now,
                'passwordHash' => $password,
                'createdAt' => $now
            ];

            $db['invitations'][$invIdx]['status'] = 'accepted';
            $db['invitations'][$invIdx]['acceptedByUserId'] = $userId;
            $db['invitations'][$invIdx]['acceptedAt'] = $now;

            $db['users'][] = $newUser;
            writeDatabase($dbFile, $db);

            $token = 'token_' . $userId . '_' . time();
            echo json_encode(['user' => sanitizeUser($newUser), 'token' => $token]);
            exit();
        }

        // New Family creation
        $familyId = 'fam_' . time() . '_' . rand(100, 999);
        $familyCode = 'CNC-' . rand(1000, 9999);
        $newFamily = [
            'id' => $familyId,
            'name' => $familyName ?: ('Famiglia ' . explode(' ', $name)[0]),
            'code' => $familyCode,
            'createdAt' => $now,
            'createdBy' => $userId,
            'notificationSettings' => [
                'whatsappEnabled' => true,
                'pushEnabled' => true,
                'soundAlarmEnabled' => true,
                'preAlertMinutes' => 15,
                'repeatIntervalMinutes' => 10,
                'autoRepeatNudges' => true,
                'customWhatsappTemplate' => "🔔 *CinicoCare Promemoria*\nÈ ora del farmaco per {paziente}: {farmaco} ({dosaggio})."
            ]
        ];

        $newUser = [
            'id' => $userId,
            'email' => $email,
            'name' => $name,
            'phone' => $phone,
            'role' => 'familiare',
            'familyId' => $familyId,
            'assignedPatientIds' => [],
            'isFamilyAdmin' => true,
            'gdprAccepted' => $gdprAccepted,
            'gdprAcceptedAt' => $now,
            'passwordHash' => $password,
            'createdAt' => $now
        ];

        $db['families'][] = $newFamily;
        $db['users'][] = $newUser;
        writeDatabase($dbFile, $db);

        $token = 'token_' . $userId . '_' . time();
        echo json_encode(['user' => sanitizeUser($newUser), 'token' => $token]);
        exit();
    }

    // AUTH REQUIRED FOR ALL BELOW ROUTES
    $currentUser = getAuthenticatedUser($db);
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Non autorizzato: effettua il login']);
        exit();
    }

    // ROUTE: Auth Logout
    if ($action === 'auth/logout') {
        echo json_encode(['message' => 'Disconnesso con successo']);
        exit();
    }

    // ROUTE: Bootstrap (Initial Load & Sync)
    if ($action === 'auth/me' || $action === 'bootstrap') {
        $familyId = $currentUser['familyId'];
        $currentFamily = null;
        if ($familyId) {
            foreach ($db['families'] as $f) {
                if ($f['id'] === $familyId) {
                    $currentFamily = $f;
                    break;
                }
            }
        }

        $patients = [];
        $therapies = [];
        $doseLogs = [];
        $members = [];
        $invitations = [];

        if ($familyId) {
            foreach ($db['patients'] as $p) {
                if ($p['familyId'] === $familyId) $patients[] = $p;
            }
            foreach ($db['therapies'] as $t) {
                if ($t['familyId'] === $familyId) $therapies[] = $t;
            }
            foreach ($db['doseLogs'] as $l) {
                if ($l['familyId'] === $familyId) $doseLogs[] = $l;
            }
            foreach ($db['users'] as $u) {
                if ($u['familyId'] === $familyId && $u['role'] !== 'superadmin') {
                    $members[] = sanitizeUser($u);
                }
            }
            foreach ($db['invitations'] as $inv) {
                if ($inv['familyId'] === $familyId) $invitations[] = $inv;
            }
        }

        echo json_encode([
            'user' => sanitizeUser($currentUser),
            'family' => $currentFamily,
            'patients' => $patients,
            'therapies' => $therapies,
            'members' => $members,
            'doseLogs' => $doseLogs,
            'invitations' => $invitations
        ]);
        exit();
    }

    // ROUTE: Dose Toggle (Check / Uncheck)
    if ($action === 'doses/toggle' && $method === 'POST') {
        $therapyId = $input['therapyId'] ?? '';
        $patientId = $input['patientId'] ?? '';
        $scheduledDate = $input['scheduledDate'] ?? '';
        $scheduledTime = $input['scheduledTime'] ?? '';
        $status = $input['status'] ?? 'taken';
        $notes = $input['notes'] ?? null;

        $logId = "{$therapyId}_{$scheduledDate}_{$scheduledTime}";
        $foundIdx = -1;
        foreach ($db['doseLogs'] as $idx => $l) {
            if ($l['id'] === $logId) {
                $foundIdx = $idx;
                break;
            }
        }

        if ($foundIdx >= 0) {
            $db['doseLogs'][$foundIdx]['status'] = $status;
            $db['doseLogs'][$foundIdx]['takenAt'] = ($status === 'taken' || $status === 'late') ? date('c') : null;
            $db['doseLogs'][$foundIdx]['takenByUserId'] = ($status === 'taken' || $status === 'late') ? $currentUser['id'] : null;
            $db['doseLogs'][$foundIdx]['takenByUserName'] = ($status === 'taken' || $status === 'late') ? $currentUser['name'] : null;
            if ($notes !== null) $db['doseLogs'][$foundIdx]['notes'] = $notes;
            $updatedLog = $db['doseLogs'][$foundIdx];
        } else {
            $updatedLog = [
                'id' => $logId,
                'familyId' => $currentUser['familyId'],
                'therapyId' => $therapyId,
                'patientId' => $patientId,
                'scheduledDate' => $scheduledDate,
                'scheduledTime' => $scheduledTime,
                'status' => $status,
                'takenAt' => ($status === 'taken' || $status === 'late') ? date('c') : null,
                'takenByUserId' => ($status === 'taken' || $status === 'late') ? $currentUser['id'] : null,
                'takenByUserName' => ($status === 'taken' || $status === 'late') ? $currentUser['name'] : null,
                'notes' => $notes,
                'notificationsSentCount' => 0,
                'lastNotifiedAt' => null
            ];
            $db['doseLogs'][] = $updatedLog;
        }

        writeDatabase($dbFile, $db);
        echo json_encode(['doseLog' => $updatedLog]);
        exit();
    }

    // ROUTE: Save Therapy
    if ($action === 'therapies' && ($method === 'POST' || $method === 'PUT')) {
        $id = $input['id'] ?? null;
        $now = date('c');

        if ($id) {
            $idx = -1;
            foreach ($db['therapies'] as $i => $t) {
                if ($t['id'] === $id) { $idx = $i; break; }
            }
            if ($idx >= 0) {
                $db['therapies'][$idx] = array_merge($db['therapies'][$idx], $input);
                $saved = $db['therapies'][$idx];
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Terapia non trovata']);
                exit();
            }
        } else {
            $newId = 'th_' . time() . '_' . rand(100, 999);
            $saved = array_merge($input, [
                'id' => $newId,
                'familyId' => $currentUser['familyId'],
                'createdAt' => $now
            ]);
            $db['therapies'][] = $saved;
        }

        writeDatabase($dbFile, $db);
        echo json_encode(['therapy' => $saved]);
        exit();
    }

    // ROUTE: Delete Therapy
    if (strpos($action, 'therapies/') === 0 && $method === 'DELETE') {
        $id = substr($action, 10);
        $db['therapies'] = array_values(array_filter($db['therapies'], function($t) use ($id) {
            return $t['id'] !== $id;
        }));
        writeDatabase($dbFile, $db);
        echo json_encode(['success' => true]);
        exit();
    }

    // ROUTE: Save Patient
    if ($action === 'patients' && ($method === 'POST' || $method === 'PUT')) {
        $id = $input['id'] ?? null;
        $now = date('c');

        if ($id) {
            $idx = -1;
            foreach ($db['patients'] as $i => $p) {
                if ($p['id'] === $id) { $idx = $i; break; }
            }
            if ($idx >= 0) {
                $db['patients'][$idx] = array_merge($db['patients'][$idx], $input);
                $saved = $db['patients'][$idx];
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Paziente non trovato']);
                exit();
            }
        } else {
            $newId = 'pat_' . time() . '_' . rand(100, 999);
            $saved = array_merge($input, [
                'id' => $newId,
                'familyId' => $currentUser['familyId'],
                'createdAt' => $now
            ]);
            $db['patients'][] = $saved;
        }

        writeDatabase($dbFile, $db);
        echo json_encode(['patient' => $saved]);
        exit();
    }

    // ROUTE: Delete Patient
    if (strpos($action, 'patients/') === 0 && $method === 'DELETE') {
        $id = substr($action, 9);
        $db['patients'] = array_values(array_filter($db['patients'], function($p) use ($id) {
            return $p['id'] !== $id;
        }));
        // Remove associated therapies
        $db['therapies'] = array_values(array_filter($db['therapies'], function($t) use ($id) {
            return $t['patientId'] !== $id;
        }));
        writeDatabase($dbFile, $db);
        echo json_encode(['success' => true]);
        exit();
    }

    // ROUTE: Create Member
    if ($action === 'members' && $method === 'POST') {
        $email = strtolower(trim($input['email'] ?? ''));
        $name = trim($input['name'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $role = $input['role'] ?? 'caregiver';
        $password = $input['password'] ?? 'Care2026!';
        $assignedPatientIds = $input['assignedPatientIds'] ?? [];

        foreach ($db['users'] as $u) {
            if (strtolower(trim($u['email'])) === $email) {
                http_response_code(400);
                echo json_encode(['error' => 'Email già registrata']);
                exit();
            }
        }

        $newMember = [
            'id' => 'user_' . time() . '_' . rand(100, 999),
            'email' => $email,
            'name' => $name,
            'phone' => $phone,
            'role' => $role,
            'familyId' => $currentUser['familyId'],
            'assignedPatientIds' => $assignedPatientIds,
            'isFamilyAdmin' => ($role === 'familiare'),
            'gdprAccepted' => true,
            'gdprAcceptedAt' => date('c'),
            'passwordHash' => $password,
            'createdAt' => date('c')
        ];

        $db['users'][] = $newMember;
        writeDatabase($dbFile, $db);
        echo json_encode(['member' => sanitizeUser($newMember)]);
        exit();
    }

    // ROUTE: Update Member
    if (strpos($action, 'members/') === 0 && ($method === 'PUT' || $method === 'POST')) {
        $id = substr($action, 8);
        $idx = -1;
        foreach ($db['users'] as $i => $u) {
            if ($u['id'] === $id) { $idx = $i; break; }
        }

        if ($idx >= 0) {
            if (isset($input['name'])) $db['users'][$idx]['name'] = trim($input['name']);
            if (isset($input['phone'])) $db['users'][$idx]['phone'] = trim($input['phone']);
            if (isset($input['role'])) $db['users'][$idx]['role'] = $input['role'];
            if (isset($input['isFamilyAdmin'])) $db['users'][$idx]['isFamilyAdmin'] = (bool)$input['isFamilyAdmin'];
            if (isset($input['assignedPatientIds'])) $db['users'][$idx]['assignedPatientIds'] = $input['assignedPatientIds'];
            if (!empty($input['password'])) $db['users'][$idx]['passwordHash'] = $input['password'];

            writeDatabase($dbFile, $db);
            echo json_encode(['member' => sanitizeUser($db['users'][$idx])]);
            exit();
        }
        http_response_code(404);
        echo json_encode(['error' => 'Membro non trovato']);
        exit();
    }

    // ROUTE: Delete Member
    if (strpos($action, 'members/') === 0 && $method === 'DELETE') {
        $id = substr($action, 8);
        $db['users'] = array_values(array_filter($db['users'], function($u) use ($id) {
            return $u['id'] !== $id;
        }));
        writeDatabase($dbFile, $db);
        echo json_encode(['success' => true]);
        exit();
    }

    // ROUTE: Create One-Time WhatsApp Invitation Link
    if ($action === 'invitations' && $method === 'POST') {
        $token = 'inv_' . substr(md5(uniqid(rand(), true)), 0, 10);
        $newInv = [
            'id' => 'invitation_' . time(),
            'familyId' => $currentUser['familyId'],
            'inviterName' => $currentUser['name'] ?: 'Familiare',
            'email' => '',
            'role' => $input['role'] ?? 'caregiver',
            'token' => $token,
            'assignedPatientIds' => $input['assignedPatientIds'] ?? [],
            'status' => 'pending',
            'createdAt' => date('c'),
            'expiresAt' => date('c', time() + 14 * 86400)
        ];

        $db['invitations'][] = $newInv;
        writeDatabase($dbFile, $db);

        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
        $baseUrl = rtrim($protocol . '://' . $host . $scriptDir, '/');
        $inviteUrl = "{$baseUrl}/?invite={$token}";

        echo json_encode(['invitation' => $newInv, 'inviteUrl' => $inviteUrl]);
        exit();
    }

    // ROUTE: Update User Profile / Password
    if ($action === 'profile' && $method === 'PUT') {
        $idx = -1;
        foreach ($db['users'] as $i => $u) {
            if ($u['id'] === $currentUser['id']) { $idx = $i; break; }
        }

        if ($idx >= 0) {
            if (!empty($input['name'])) $db['users'][$idx]['name'] = trim($input['name']);
            if (!empty($input['email'])) {
                $newEmail = strtolower(trim($input['email']));
                foreach ($db['users'] as $checkU) {
                    if ($checkU['id'] !== $currentUser['id'] && strtolower(trim($checkU['email'])) === $newEmail) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Email già utilizzata da un altro account']);
                        exit();
                    }
                }
                $db['users'][$idx]['email'] = $newEmail;
            }
            if (isset($input['phone'])) $db['users'][$idx]['phone'] = trim($input['phone']);

            if (!empty($input['newPassword'])) {
                if ($currentUser['role'] !== 'superadmin' && !empty($input['currentPassword'])) {
                    if ($db['users'][$idx]['passwordHash'] !== $input['currentPassword']) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Password attuale non corretta']);
                        exit();
                    }
                }
                $db['users'][$idx]['passwordHash'] = $input['newPassword'];
            }

            writeDatabase($dbFile, $db);
            echo json_encode(['user' => sanitizeUser($db['users'][$idx])]);
            exit();
        }
        http_response_code(404);
        echo json_encode(['error' => 'Utente non trovato']);
        exit();
    }

    // ROUTE: Save Family Settings
    if ($action === 'family/settings' && $method === 'PUT') {
        $famId = $currentUser['familyId'];
        $idx = -1;
        foreach ($db['families'] as $i => $f) {
            if ($f['id'] === $famId) { $idx = $i; break; }
        }

        if ($idx >= 0) {
            if (!empty($input['name'])) $db['families'][$idx]['name'] = trim($input['name']);
            if (isset($input['notificationSettings'])) {
                $db['families'][$idx]['notificationSettings'] = array_merge(
                    $db['families'][$idx]['notificationSettings'] ?? [],
                    $input['notificationSettings']
                );
            }
            writeDatabase($dbFile, $db);
            echo json_encode(['family' => $db['families'][$idx]]);
            exit();
        }
        http_response_code(404);
        echo json_encode(['error' => 'Famiglia non trovata']);
        exit();
    }

    // ROUTE: SuperAdmin Overview
    if ($action === 'admin/overview') {
        if ($currentUser['role'] !== 'superadmin') {
            http_response_code(403);
            echo json_encode(['error' => 'Accesso negato: riservato all\'Amministratore Generale']);
            exit();
        }

        $familiesWithCounts = array_map(function($f) use ($db) {
            $pCount = 0;
            $mCount = 0;
            $tCount = 0;
            foreach ($db['patients'] as $p) { if ($p['familyId'] === $f['id']) $pCount++; }
            foreach ($db['users'] as $u) { if ($u['familyId'] === $f['id']) $mCount++; }
            foreach ($db['therapies'] as $t) { if ($t['familyId'] === $f['id']) $tCount++; }
            return array_merge($f, [
                'patientsCount' => $pCount,
                'membersCount' => $mCount,
                'therapiesCount' => $tCount
            ]);
        }, $db['families']);

        $allUsers = array_map(function($u) use ($db) {
            $sanitized = sanitizeUser($u);
            $famName = 'Nessuna';
            if ($u['familyId']) {
                foreach ($db['families'] as $f) {
                    if ($f['id'] === $u['familyId']) { $famName = $f['name']; break; }
                }
            }
            $sanitized['familyName'] = $famName;
            return $sanitized;
        }, $db['users']);

        echo json_encode([
            'totalFamilies' => count($db['families']),
            'totalPatients' => count($db['patients']),
            'totalTherapies' => count($db['therapies']),
            'totalUsers' => count($db['users']),
            'totalDoseLogs' => count($db['doseLogs']),
            'families' => $familiesWithCounts,
            'allUsers' => $allUsers,
            'recentLogs' => array_slice(array_reverse($db['doseLogs']), 0, 50)
        ]);
        exit();
    }

    // ROUTE: Admin Reset Database
    if ($action === 'admin/reset' && $method === 'POST') {
        if ($currentUser['role'] !== 'superadmin') {
            http_response_code(403);
            echo json_encode(['error' => 'Riservato all\'Amministratore']);
            exit();
        }

        if (strtoupper(trim($input['confirmationCode'] ?? '')) !== 'CANCELLA') {
            http_response_code(400);
            echo json_encode(['error' => 'Codice di sicurezza errato. Digita CANCELLA']);
            exit();
        }

        $fresh = getInitialDatabase();
        writeDatabase($dbFile, $fresh);
        echo json_encode(['success' => true, 'message' => 'Database resettato con successo']);
        exit();
    }

    // ROUTE: Export Backup
    if ($action === 'admin/export') {
        if ($currentUser['role'] !== 'superadmin') {
            http_response_code(403);
            echo json_encode(['error' => 'Riservato all\'Amministratore']);
            exit();
        }
        echo json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit();
    }

    // ROUTE: Import Backup
    if ($action === 'admin/import' && $method === 'POST') {
        if ($currentUser['role'] !== 'superadmin') {
            http_response_code(403);
            echo json_encode(['error' => 'Riservato all\'Amministratore']);
            exit();
        }

        $backupData = $input['backup'] ?? $input;
        if (!is_array($backupData) || !isset($backupData['users'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Struttura file di backup non valida']);
            exit();
        }

        writeDatabase($dbFile, $backupData);
        echo json_encode(['success' => true, 'message' => 'Backup ripristinato con successo']);
        exit();
    }

    // Azione sconosciuta
    http_response_code(404);
    echo json_encode(['error' => "Endpoint API '{$action}' non trovato"]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
