import requests  # pip3 install requests

url = "http://localhost:8000/api/v1/connected?user=call-me"

authorization = "call_me_api_key_secret"

headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)

print(response.json())