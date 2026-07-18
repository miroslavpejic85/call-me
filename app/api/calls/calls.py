import requests # pip3 install requests

# Optionally filter by room: append ?room=Support (returns all rooms when omitted)
url = "http://localhost:8000/api/v1/calls"

authorization = "call_me_api_key_secret"

headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)

print(response.json())
