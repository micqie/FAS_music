<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once 'db_connect.php';
require_once 'auth_session.php';
require_once 'xss_protection.php';
header('Content-Type: application/json');
XSSProtection::sendSecurityHeaders();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

function lm_json($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function lm_normalize_name($value) {
    return preg_replace('/\s+/', ' ', trim((string)$value));
}

function lm_ensure(PDO $conn) {
    $conn->exec("CREATE TABLE IF NOT EXISTS tbl_learning_materials (
        material_id INT AUTO_INCREMENT PRIMARY KEY,
        instrument_type VARCHAR(100) NOT NULL,
        level_name VARCHAR(100) NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        file_path VARCHAR(500) NULL,
        original_filename VARCHAR(255) NULL,
        status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_learning_material (instrument_type, level_name, material_name),
        INDEX idx_learning_material_lookup (instrument_type, level_name, status)
    )");
    foreach ([
        'description' => "ALTER TABLE tbl_learning_materials ADD COLUMN description TEXT NULL AFTER material_name",
        'file_path' => "ALTER TABLE tbl_learning_materials ADD COLUMN file_path VARCHAR(500) NULL AFTER description",
        'original_filename' => "ALTER TABLE tbl_learning_materials ADD COLUMN original_filename VARCHAR(255) NULL AFTER file_path",
        'updated_at' => "ALTER TABLE tbl_learning_materials ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
    ] as $column => $sql) {
        $check = $conn->prepare('SHOW COLUMNS FROM tbl_learning_materials LIKE ?');
        $check->execute([$column]);
        if (!$check->fetch()) $conn->exec($sql);
    }
    $conn->exec("CREATE TABLE IF NOT EXISTS tbl_learning_material_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        instrument_type VARCHAR(100) NOT NULL,
        level_name VARCHAR(100) NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        request_reason TEXT NULL,
        status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        review_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_material_request_status (status, created_at),
        INDEX idx_material_request_teacher (teacher_id, status)
    )");
}

function lm_upload($file) {
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return [null, null];
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) lm_json(['error' => 'The material file could not be uploaded.'], 400);
    if ((int)($file['size'] ?? 0) > 10 * 1024 * 1024) lm_json(['error' => 'Material files may not exceed 10 MB.'], 400);
    $allowed = ['application/pdf'=>'pdf','application/msword'=>'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document'=>'docx'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($allowed[$mime])) lm_json(['error' => 'Upload a PDF, DOC, or DOCX file.'], 400);
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'learning_materials';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) lm_json(['error' => 'Unable to prepare the upload folder.'], 500);
    $filename = date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $filename)) lm_json(['error' => 'Unable to save the uploaded material.'], 500);
    return ['uploads/learning_materials/' . $filename, basename((string)$file['name'])];
}

$user = fas_require_authenticated_user($conn);
$roleCategory = fas_normalize_role_category($user['role_name'] ?? '');
lm_ensure($conn);
$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

try {
    if ($action === 'my-specializations') {
        if ($roleCategory !== 'instructor') lm_json(['error'=>'Instructor access required.'],403);
        $stmt=$conn->prepare("SELECT DISTINCT it.type_name instrument_type
            FROM tbl_teachers t
            INNER JOIN tbl_teacher_specializations ts ON ts.teacher_id=t.teacher_id
            INNER JOIN tbl_specialization sp ON sp.specialization_id=ts.specialization_id
            INNER JOIN tbl_instrument_types it ON it.type_id=sp.type_id
            WHERE t.user_id=? AND t.status='Active' AND sp.status='Active'
            ORDER BY instrument_type");
        $stmt->execute([(int)$user['user_id']]);
        lm_json(['success'=>true,'instruments'=>array_values(array_filter(array_column($stmt->fetchAll(PDO::FETCH_ASSOC)?:[],'instrument_type')))]);
    }
    if ($action === 'request') {
        if ($roleCategory !== 'instructor') lm_json(['error'=>'Instructor access required.'],403);
        $data=json_decode(file_get_contents('php://input'),true)?:[];
        $instrument=lm_normalize_name($data['instrument_type']??''); $level=lm_normalize_name($data['level_name']??'');
        $name=lm_normalize_name($data['material_name']??''); $reason=trim((string)($data['request_reason']??''));
        if ($instrument===''||$level===''||$name==='') lm_json(['error'=>'Instrument, level, and book/material name are required.'],400);
        $teacherStmt=$conn->prepare('SELECT teacher_id FROM tbl_teachers WHERE user_id=? AND status=\'Active\' LIMIT 1'); $teacherStmt->execute([(int)$user['user_id']]); $teacherId=(int)($teacherStmt->fetchColumn()?:0);
        if ($teacherId<1) lm_json(['error'=>'Instructor record not found.'],404);
        $specialization=$conn->prepare("SELECT 1 FROM tbl_teacher_specializations ts INNER JOIN tbl_specialization sp ON sp.specialization_id=ts.specialization_id INNER JOIN tbl_instrument_types it ON it.type_id=sp.type_id WHERE ts.teacher_id=? AND BINARY it.type_name=BINARY ? LIMIT 1");
        $specialization->execute([$teacherId,$instrument]);
        if (!$specialization->fetchColumn()) lm_json(['error'=>'You may request materials only for your instructor specialization.'],403);
        $duplicate=$conn->prepare("SELECT 1 FROM tbl_learning_materials WHERE LOWER(TRIM(instrument_type))=LOWER(?) AND LOWER(TRIM(level_name))=LOWER(?) AND LOWER(TRIM(material_name))=LOWER(?) AND status='Active' LIMIT 1"); $duplicate->execute([$instrument,$level,$name]);
        if ($duplicate->fetchColumn()) lm_json(['error'=>'That material is already available in the masterfile.'],409);
        $pending=$conn->prepare("SELECT 1 FROM tbl_learning_material_requests WHERE teacher_id=? AND LOWER(TRIM(instrument_type))=LOWER(?) AND LOWER(TRIM(level_name))=LOWER(?) AND LOWER(TRIM(material_name))=LOWER(?) AND status='Pending' LIMIT 1"); $pending->execute([$teacherId,$instrument,$level,$name]);
        if ($pending->fetchColumn()) lm_json(['error'=>'You already have a pending request for this material.'],409);
        $conn->prepare("INSERT INTO tbl_learning_material_requests (teacher_id,instrument_type,level_name,material_name,request_reason) VALUES (?,?,?,?,?)")->execute([$teacherId,$instrument,$level,$name,$reason?:null]);
        lm_json(['success'=>true,'message'=>'Book request sent to Admin for approval.']);
    }
    if ($action === 'my-requests') {
        if ($roleCategory !== 'instructor') lm_json(['error'=>'Instructor access required.'],403);
        $stmt=$conn->prepare("SELECT r.* FROM tbl_learning_material_requests r INNER JOIN tbl_teachers t ON t.teacher_id=r.teacher_id WHERE t.user_id=? ORDER BY r.created_at DESC"); $stmt->execute([(int)$user['user_id']]);
        lm_json(['success'=>true,'requests'=>$stmt->fetchAll(PDO::FETCH_ASSOC)?:[]]);
    }
    if (!in_array($roleCategory, ['admin','owner'], true)) lm_json(['error' => 'Admin or owner access required.'], 403);
    if ($action === 'list') {
        $rows = $conn->query("SELECT * FROM tbl_learning_materials ORDER BY status='Active' DESC, instrument_type, level_name, material_name")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        lm_json(['success'=>true,'materials'=>$rows]);
    }
    if ($action === 'requests') {
        $rows=$conn->query("SELECT r.*,CONCAT(t.first_name,' ',t.last_name) instructor_name FROM tbl_learning_material_requests r INNER JOIN tbl_teachers t ON t.teacher_id=r.teacher_id ORDER BY r.status='Pending' DESC,r.created_at DESC")->fetchAll(PDO::FETCH_ASSOC)?:[];
        lm_json(['success'=>true,'requests'=>$rows]);
    }
    if ($action === 'review-request') {
        $data=json_decode(file_get_contents('php://input'),true)?:[]; $id=(int)($data['request_id']??0); $decision=(string)($data['decision']??''); $notes=trim((string)($data['review_notes']??''));
        if (!in_array($decision,['Approved','Rejected'],true)) lm_json(['error'=>'Approved or Rejected decision required.'],400);
        $stmt=$conn->prepare("SELECT * FROM tbl_learning_material_requests WHERE request_id=? AND status='Pending' LIMIT 1 FOR UPDATE");
        $conn->beginTransaction(); $stmt->execute([$id]); $request=$stmt->fetch(PDO::FETCH_ASSOC);
        if (!$request) { $conn->rollBack(); lm_json(['error'=>'Pending request not found.'],404); }
        if ($decision==='Approved') {
            $existing=$conn->prepare("SELECT material_id FROM tbl_learning_materials WHERE LOWER(TRIM(instrument_type))=LOWER(?) AND LOWER(TRIM(level_name))=LOWER(?) AND LOWER(TRIM(material_name))=LOWER(?) LIMIT 1 FOR UPDATE");
            $existing->execute([$request['instrument_type'],$request['level_name'],$request['material_name']]);
            $existingId=(int)($existing->fetchColumn()?:0);
            if ($existingId>0) {
                $conn->prepare("UPDATE tbl_learning_materials SET status='Active',description=COALESCE(NULLIF(?,''),description) WHERE material_id=?")->execute([$request['request_reason'],$existingId]);
            } else {
                $conn->prepare("INSERT INTO tbl_learning_materials (instrument_type,level_name,material_name,description,status) VALUES (?,?,?,?,'Active')")->execute([$request['instrument_type'],$request['level_name'],$request['material_name'],$request['request_reason']]);
            }
        }
        $conn->prepare("UPDATE tbl_learning_material_requests SET status=?,reviewed_by=?,reviewed_at=NOW(),review_notes=? WHERE request_id=?")->execute([$decision,(int)$user['user_id'],$notes?:null,$id]);
        $conn->commit(); lm_json(['success'=>true,'message'=>$decision==='Approved'?'Request approved and added to the masterfile.':'Request rejected.']);
    }
    if ($action === 'save') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') lm_json(['error'=>'Method not allowed'],405);
        $id=(int)($_POST['material_id']??0); $instrument=lm_normalize_name($_POST['instrument_type']??'');
        $level=lm_normalize_name($_POST['level_name']??''); $name=lm_normalize_name($_POST['material_name']??'');
        $description=trim((string)($_POST['description']??''));
        if ($instrument===''||$level===''||$name==='') lm_json(['error'=>'Instrument, level, and material name are required.'],400);
        $duplicate=$conn->prepare("SELECT material_id FROM tbl_learning_materials WHERE LOWER(TRIM(instrument_type))=LOWER(?) AND LOWER(TRIM(level_name))=LOWER(?) AND LOWER(TRIM(material_name))=LOWER(?) AND material_id<>? LIMIT 1");
        $duplicate->execute([$instrument,$level,$name,$id]);
        if ($duplicate->fetchColumn()) lm_json(['error'=>'That material already exists for this instrument and level (names are checked without regard to capitalization).'],409);
        [$path,$original]=lm_upload($_FILES['material_file']??null);
        if ($id>0) {
            $old=$conn->prepare('SELECT file_path FROM tbl_learning_materials WHERE material_id=? LIMIT 1'); $old->execute([$id]); $oldPath=$old->fetchColumn();
            if ($path) {
                $stmt=$conn->prepare("UPDATE tbl_learning_materials SET instrument_type=?,level_name=?,material_name=?,description=?,file_path=?,original_filename=?,status='Active' WHERE material_id=?");
                $stmt->execute([$instrument,$level,$name,$description?:null,$path,$original,$id]);
                if ($oldPath && str_starts_with($oldPath,'uploads/learning_materials/')) { $full=dirname(__DIR__).DIRECTORY_SEPARATOR.str_replace('/',DIRECTORY_SEPARATOR,$oldPath); if (is_file($full)) @unlink($full); }
            } else {
                $stmt=$conn->prepare("UPDATE tbl_learning_materials SET instrument_type=?,level_name=?,material_name=?,description=? WHERE material_id=?");
                $stmt->execute([$instrument,$level,$name,$description?:null,$id]);
            }
        } else {
            $stmt=$conn->prepare("INSERT INTO tbl_learning_materials (instrument_type,level_name,material_name,description,file_path,original_filename,status) VALUES (?,?,?,?,?,?,'Active')");
            $stmt->execute([$instrument,$level,$name,$description?:null,$path,$original]);
            $id=(int)$conn->lastInsertId();
        }
        lm_json(['success'=>true,'message'=>'Learning material saved.','material_id'=>$id]);
    }
    if ($action === 'status') {
        $data=json_decode(file_get_contents('php://input'),true)?:[]; $id=(int)($data['material_id']??0); $status=($data['status']??'')==='Active'?'Active':'Inactive';
        $conn->prepare('UPDATE tbl_learning_materials SET status=? WHERE material_id=?')->execute([$status,$id]);
        lm_json(['success'=>true,'message'=>$status==='Active'?'Material restored.':'Material archived.']);
    }
    if ($action === 'delete') {
        $data=json_decode(file_get_contents('php://input'),true)?:[]; $id=(int)($data['material_id']??0);
        $stmt=$conn->prepare('SELECT file_path FROM tbl_learning_materials WHERE material_id=? LIMIT 1'); $stmt->execute([$id]); $path=$stmt->fetchColumn();
        $conn->prepare('DELETE FROM tbl_learning_materials WHERE material_id=?')->execute([$id]);
        if ($path && str_starts_with($path,'uploads/learning_materials/')) { $full=dirname(__DIR__).DIRECTORY_SEPARATOR.str_replace('/',DIRECTORY_SEPARATOR,$path); if (is_file($full)) @unlink($full); }
        lm_json(['success'=>true,'message'=>'Material permanently deleted.']);
    }
    lm_json(['error'=>'Unknown action'],400);
} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    if ((string)$e->getCode()==='23000') lm_json(['error'=>'That material is already assigned to this instrument and level.'],409);
    lm_json(['error'=>'Database error: '.$e->getMessage()],500);
}
