#!/bin/bash

# Aggregate server statistics: version, uptime, total users, rooms and active calls
url="http://localhost:8000/api/v1/stats";

authorization="call_me_api_key_secret"

response=$(curl -s -X GET "$url" -H "Authorization: $authorization" -H "Content-Type: application/json")

echo "$response"
