'use strict';

// Optionally filter by room: append ?room=Support (returns all rooms when omitted)
const url = 'http://localhost:8000/api/v1/calls';

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
