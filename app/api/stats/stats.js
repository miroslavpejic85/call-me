'use strict';

// Aggregate server statistics: version, uptime, total users, rooms and active calls
const url = 'http://localhost:8000/api/v1/stats';

const authorization = 'call_me_api_key_secret';

fetch(url, {
    method: 'GET',
    headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
    },
})
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error('Error:', error));
