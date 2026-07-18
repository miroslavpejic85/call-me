import requests # pip3 install requests

# List active rooms with user counts and active call counts
url = "http://localhost:8000/api/v1/rooms"

authorization = "call_me_api_key_secret"

headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)

print(response.json())
