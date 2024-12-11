import requests  # pip3 install requests

url = "http://localhost:8000/api/v1/connected"

authorization = "call_me_api_key_secret"

headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json'
}

data = {
    'user': 'call-me'
}

response = requests.post(url, headers=headers, json=data)

print(response.json())