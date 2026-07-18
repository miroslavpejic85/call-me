import requests # pip3 install requests

# Aggregate server statistics: version, uptime, total users, rooms and active calls
url = "http://localhost:8000/api/v1/stats"

authorization = "call_me_api_key_secret"

headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)

print(response.json())
