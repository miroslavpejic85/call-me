'use strict';

const url = 'http://localhost:8000/api/v1/connected';

const authorization = 'call_me_api_key_secret';

fetch(url, {
    method: 'POST',
    headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        user: 'call-me',
    }),
})
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error('Error:', error));
