#!/bin/bash

url="http://localhost:8000/api/v1/connected?user=call-me";

authorization="call_me_api_key_secret"

response=$(curl -s -X GET "$url" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json")

echo "$response"
