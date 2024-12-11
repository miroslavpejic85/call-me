#!/bin/bash

url="http://localhost:8000/api/v1/users";

authorization="call_me_api_key_secret"

response=$(curl -s -X GET "$url" -H "Authorization: $authorization" -H "Content-Type: application/json")

echo "$response"
