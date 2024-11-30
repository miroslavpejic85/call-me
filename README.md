# Call-Me

This project enables easy one-to-one video calls directly from your web browser using WebRTC technology.

![callme](./assets/doc/callme.png)

## Getting Started

### Overview

This project allows you to:

- `Sign in` with a username.
- `Make video calls` by entering the recipient's username.
- `Toggle` your video feed visibility.
- `Hang up` the call when done.
- `Rest API` to get all connected users.

---

### Quick Start

- #### Using NodeJs

![nodejs](public/assets/nodejs.png)

**[Install Node.js and npm](https://nodejs.org/en/download)**

```shell
# Clone this repo
git clone https://github.com/miroslavpejic85/call-me.git

# Go to to dir call-me
cd call-me

# Copy .env.template to .env
cp .env.template .env

# Install dependencies
npm install

# Start the application
npm start
```

---

- #### Using Docker

![docker](public/assets/docker.png)

Install [docker engine](https://docs.docker.com/engine/install/) and [docker compose](https://docs.docker.com/compose/install/)

```shell
# Clone this repo
git clone https://github.com/miroslavpejic85/call-me.git

# Go to to dir call-me
cd call-me

# Copy .env.template to .env
cp .env.template .env

# Get official image from Docker Hub
docker-compose pull

# Create and start containers
docker-compose up
```

---

1. Open your browser and visit [http://localhost:8000](http://localhost:8000).

2. Sign in with your username.

3. Enter the recipient's username and click `Call`.

4. Enjoy your one-to-one video call.

---

## Click to Call

Allows a user to `join` the room as a `user1`

[http://localhost:8000/join?user=user1](http://localhost:8000/join?user=user1)

Lets the `user2 join` the room and initiate a `call` to the `user1`

[http://localhost:8000/join?user=user2&call=user1](http://localhost:8000/join?user=user2&call=user1)

---

## Fast Integration

![iframe](public/assets/iframe.png)

Easily integrate `Call-Me` into your website or application with a [simple iframe](https://codepen.io/Miroslav-Pejic/pen/qEWBaKP). Just add the following code to your project:

```html
<iframe
    allow="camera; microphone; fullscreen; autoplay"
    src="https://cme.mirotalk.com/"
    style="width: 100vw; height: 100vh; border: 0px;"
></iframe>
```

---

## API

Get all connected users

```shell
curl -X GET "http://localhost:8000/api/v1/users" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json"
```

Docs: http://localhost:8000/api/v1/docs/ or you can check it out live [here](https://cme.mirotalk.com/api/v1/docs/).

---

## Self-Hosting

To install this on your VPS, VDS, or personal server, please follow the instructions in **[the self-hosting documentation](./doc/self-hosting.md)**.

---
