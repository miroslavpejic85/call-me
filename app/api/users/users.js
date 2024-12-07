'use strict';

const $url = 'https://localhost:8000/api/v1/users';

const authorization = 'call_me_api_key_secret';

fetch(url, {
    method: 'GET',
    headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
    },
})
    .then((response) => response.json()) // Parse the JSON response
    .then((data) => console.log(data)) // Log the data
    .catch((error) => console.error('Error:', error)); // Handle errors
