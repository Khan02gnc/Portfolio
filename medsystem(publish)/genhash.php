<?php
$hash = password_hash('medsystem', PASSWORD_DEFAULT);
echo $hash;
echo '<br><br>';
echo password_verify('medsystem', $hash) ? 'VERIFY: OK' : 'VERIFY: FAILED';
?>