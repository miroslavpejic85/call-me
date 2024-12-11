<?php

$url = "http://localhost:8000/api/v1/connected";
$authorization = "call_me_api_key_secret";

// Data to send in the request body
$data = json_encode(array('user' => 'call-me'));

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    "authorization: $authorization",
    "Content-Type: application/json"
));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>

