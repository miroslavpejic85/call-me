#!/bin/bash

url="http://localhost:8000/api/v1/connected";

authorization="call_me_api_key_secret"

response=$(curl -s -X POST "$url" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json" -d '{"user": "call-me"}')

echo "$response"
