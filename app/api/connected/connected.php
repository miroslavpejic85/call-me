<?php

$url = "http://localhost:8000/api/v1/connected?user=call-me";

$authorization = "call_me_api_key_secret";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    "authorization: $authorization",
    "Content-Type: application/json"
));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>

