<?php
declare(strict_types=1);
function out($data, int $status = 200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function(Throwable $e) { error_log((string)$e); out(['error'=>'サーバーでエラーが発生しました。'],500); });
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
$dir = getenv('BLOG_DATA_DIR') ?: __DIR__.'/data';
foreach ([$dir, "$dir/sessions", "$dir/uploads"] as $d) if (!is_dir($d)) mkdir($d,0700,true);
session_save_path("$dir/sessions");
session_name('blog_session');
session_start(['use_strict_mode'=>1,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$db = new PDO('sqlite:'.$dir.'/blog.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE COLLATE NOCASE NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,author_id INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,content TEXT NOT NULL,image TEXT NOT NULL DEFAULT "",published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS posts_author ON posts(author_id);');
function sql(string $q,array $p=[]): PDOStatement { global $db; $s=$db->prepare($q); $s->execute($p); return $s; }
function me() { return isset($_SESSION['uid']) ? sql('SELECT id,name,email FROM users WHERE id=?',[$_SESSION['uid']])->fetch() ?: null : null; }
function auth(): array { $u=me(); if(!$u) out(['error'=>'ログインしてください。'],401); return $u; }
function value(array $data,string $key,int $min,int $max): string { $v=$data[$key]??''; if(!is_string($v)) out(['error'=>"$key の形式が不正です。"],422); $v=trim($v); if(mb_strlen($v)<$min || mb_strlen($v)>$max) out(['error'=>"$key は $min ～ $max 文字で入力してください。"],422); return $v; }
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH); $method=$_SERVER['REQUEST_METHOD'];
if(!in_array($method,['GET','HEAD'],true) && !hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) out(['error'=>'画面を再読み込みしてください。'],403);
$input=$_POST;
if(str_contains($_SERVER['CONTENT_TYPE']??'','application/json')) { $input=json_decode(file_get_contents('php://input'),true); if(!is_array($input)) out(['error'=>'JSONが不正です。'],400); }
if($path==='/api/session' && $method==='GET') out(['user'=>me(),'csrf'=>$_SESSION['csrf']]);
if($path==='/api/register' && $method==='POST') {
 $name=value($input,'name',1,80); $email=value($input,'email',3,254); $password=value($input,'password',8,32);
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)) out(['error'=>'メールアドレスが不正です。'],422);
 if($password!==($input['confirmPassword']??'')) out(['error'=>'パスワードが一致しません。'],422);
 if(sql('SELECT id FROM users WHERE email=?',[$email])->fetch()) out(['error'=>'登録済みのメールアドレスです。'],409);
 sql('INSERT INTO users(name,email,password) VALUES(?,?,?)',[$name,$email,password_hash($password,PASSWORD_DEFAULT)]);
 session_regenerate_id(true); $_SESSION['uid']=(int)$db->lastInsertId(); out(me(),201);
}
if($path==='/api/login' && $method==='POST') {
 $email=value($input,'email',1,254); $password=value($input,'password',1,128);
 $u=sql('SELECT * FROM users WHERE email=?',[$email])->fetch();
 if(!$u || !password_verify($password,$u['password'])) out(['error'=>'メールアドレスまたはパスワードが違います。'],401);
 session_regenerate_id(true); $_SESSION['uid']=$u['id']; out(me());
}
if($path==='/api/logout' && $method==='POST') { unset($_SESSION['uid']); session_regenerate_id(true); out(['ok'=>true]); }
$select='SELECT p.*,u.name AS author FROM posts p JOIN users u ON u.id=p.author_id';
if($path==='/api/posts' && $method==='GET') {
 $params=[]; $where='p.published=1';
 if(($_GET['mine']??'')==='1') { $u=auth(); $where='p.author_id=?'; $params[]=$u['id']; }
 $search=$_GET['search']??''; if(!is_string($search)) out(['error'=>'検索条件が不正です。'],422);
 if($search!=='') { $where.=' AND (p.title LIKE ? OR p.content LIKE ?)'; $params[]='%'.$search.'%'; $params[]='%'.$search.'%'; }
 out(sql("$select WHERE $where ORDER BY p.id DESC",$params)->fetchAll());
}
if(preg_match('~^/api/posts/(\d+)$~',$path,$m)) {
 $post=sql("$select WHERE p.id=?",[$m[1]])->fetch();
 if(!$post) out(['error'=>'記事が見つかりません。'],404);
 if($method==='GET') { if(!$post['published'] && (me()['id']??null)!==$post['author_id']) out(['error'=>'記事が見つかりません。'],404); out($post); }
 $u=auth(); if($u['id']!==$post['author_id']) out(['error'=>'この記事は変更できません。'],403);
 if($method==='DELETE') { sql('DELETE FROM posts WHERE id=?',[$post['id']]); out(['ok'=>true]); }
}
if(($path==='/api/posts' || isset($post)) && $method==='POST') {
 $u=auth(); $title=value($input,'title',3,255); $content=value($input,'content',10,100000);
 $published=$input['published']??'1'; if(!in_array((string)$published,['0','1'],true)) out(['error'=>'公開設定が不正です。'],422);
 $img=isset($post) ? $post['image'] : ''; if(($input['removeImage']??'')==='1') $img='';
 if(isset($_FILES['image']) && $_FILES['image']['error']!==UPLOAD_ERR_NO_FILE) {
  $f=$_FILES['image']; if($f['error']!==UPLOAD_ERR_OK || $f['size']>5*1024*1024) out(['error'=>'画像は5MB以下でアップロードしてください。'],422);
  $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']); $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif'][$mime]??null;
  if(!$ext || !getimagesize($f['tmp_name'])) out(['error'=>'JPEG・PNG・WebP・GIF画像を指定してください。'],422);
  $file=bin2hex(random_bytes(16)).'.'.$ext; if(!move_uploaded_file($f['tmp_name'],"$dir/uploads/$file")) throw new RuntimeException('Upload failed'); $img='/api/media/'.$file;
 }
 $now=gmdate('Y-m-d\TH:i:s\Z');
 if(isset($post)) { sql('UPDATE posts SET title=?,content=?,image=?,published=?,updated_at=? WHERE id=?',[$title,$content,$img,(int)$published,$now,$post['id']]); $id=$post['id']; }
 else { sql('INSERT INTO posts(author_id,title,content,image,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[$u['id'],$title,$content,$img,(int)$published,$now,$now]); $id=(int)$db->lastInsertId(); }
 out(sql("$select WHERE p.id=?",[$id])->fetch(),isset($post)?200:201);
}
if(preg_match('~^/api/media/([a-f0-9]{32}\.(jpg|png|webp|gif))$~',$path,$m) && $method==='GET') {
 $p=sql('SELECT author_id,published FROM posts WHERE image=?',[$path])->fetch();
 if(!$p || (!$p['published'] && (me()['id']??null)!==$p['author_id']) || !is_file("$dir/uploads/$m[1]")) out(['error'=>'画像が見つかりません。'],404);
 header('Content-Type: '.(new finfo(FILEINFO_MIME_TYPE))->file("$dir/uploads/$m[1]")); readfile("$dir/uploads/$m[1]"); exit;
}
if($path==='/api/contacts' && $method==='POST') {
 $name=value($input,'name',3,20); $email=value($input,'email',3,254); $message=value($input,'message',1,5000);
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)) out(['error'=>'メールアドレスが不正です。'],422);
 sql('INSERT INTO contacts(name,email,message,created_at) VALUES(?,?,?,?)',[$name,$email,$message,gmdate('c')]); out(['ok'=>true],201);
}
out(['error'=>'ページが見つかりません。'],404);
