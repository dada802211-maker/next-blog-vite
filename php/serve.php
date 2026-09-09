<?php
$port = $argv[1] ?? '8020';
if (!ctype_digit($port) || (int)$port < 1024 || (int)$port > 65535) { fwrite(STDERR,"Invalid port\n"); exit(1); }
passthru(escapeshellarg(PHP_BINARY).' -d upload_max_filesize=5M -d post_max_size=6M -S 127.0.0.1:'.$port.' -t '.escapeshellarg(__DIR__).' '.escapeshellarg(__DIR__.'/router.php'),$code);
exit($code);
