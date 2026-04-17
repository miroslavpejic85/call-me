<h1 align="center">Call-me</h1>

<br/>

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/miroslavpejic85/call-me?style=social)](https://github.com/miroslavpejic85/call-me/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/miroslavpejic85/call-me?style=social)](https://github.com/miroslavpejic85/call-me/network/members)

<a href="https://choosealicense.com/licenses/agpl-3.0/">![License: AGPLv3](https://img.shields.io/badge/License-AGPLv3_Open_Source-blue.svg)</a>
<a href="https://hub.docker.com/r/mirotalk/call-me">![Docker Pulls](https://img.shields.io/docker/pulls/mirotalk/cme)</a>
<a href="https://github.com/miroslavpejic85/call-me/commits/master">![Last Commit](https://img.shields.io/github/last-commit/miroslavpejic85/call-me)</a>
<a href="https://discord.gg/rgGYfeYW3N">![Discord](https://img.shields.io/badge/Discord-Community-5865F2?logo=discord&logoColor=white)</a>
<a href="https://www.linkedin.com/in/miroslav-pejic-976a07101/">![Author](https://img.shields.io/badge/Author-Miroslav_Pejic-brightgreen.svg)</a>

</div>

<p align="center">
Instant click-to-call video communication in your browser, no signup, no setup, powered by WebRTC.
</p>

<p align="center">
    <a href="https://cme.mirotalk.com">Try Live Demo</a> · <a 
href="https://cme.mirotalk.com/privacy">Privacy</a> · <a 
href="https://docs.mirotalk.com/mirotalk-cme/self-hosting/">Documentation</a> · <a href="https://discord.gg/rgGYfeYW3N">Discord</a> · <a 
href="https://github.com/sponsors/miroslavpejic85">Sponsor</a>
</p>

![callme](./assets/doc/callme.png)

## Getting Started

### Features

- `End-to-End Encryption` for secure and private communications.
- `Join` with a username or enter a name to `Call now`.
- `Set your preferred language`.
- `Initiate video calls` by clicking the call button next to a recipient’s username.
- `Switch between cameras, microphones, and speakers` during a call.
- `Chat in real time` with participants.
- `Hide your video` feed when needed.
- `Toggle your microphone` (mute/unmute).
- `Toggle your camera` (video on/off).
- `Share your screen` (start/stop).
- `Share files` with other participants.
- `Hang up the call` when finished.
- `Enable Host Protection` mode with a password.
- `Enable Web Push Notifications` to get notified of incoming calls even when the app is in the background.
- `Use the REST API` to retrieve the list of connected users or initiate a call.

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

# Copy the config file
cp public/config.template.js public/config.js

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

# Copy the config file
cp public/config.template.js public/config.js

# Copy .env.template to .env
cp .env.template .env

# Create your own docker-compose.yml
cp docker-compose.template.yml docker-compose.yml

# Get official image from Docker Hub
docker-compose pull

# Create and start containers
docker-compose up
```

---

1. `Open` your browser and visit [http://localhost:8000](http://localhost:8000).

2. `Join` with your username or `Call` the recipient directly.

3. `Select` the connected recipient's username and click `Call`.

4. `Enjoy` your one-to-one video call.

---

## Click to Call

Allows a user to `join` the room as a `user1`

- [http://localhost:8000/join?user=user1](http://localhost:8000/join?user=user1) (dev)
- [https://cme.mirotalk.com/join?user=user1](https://cme.mirotalk.com/join?user=user1) (prod)

Lets the `user2 join` the room and initiate a `call` to the `user1`

- [http://localhost:8000/join?user=user2&call=user1](http://localhost:8000/join?user=user2&call=user1) (dev)
- [https://cme.mirotalk.com/join?user=user2&call=user1](https://cme.mirotalk.com/join?user=user2&call=user1) (prod)

You can explore a `widget` example that demonstrates this functionality [here](./integration/widget.html).

---

<details open>
<summary>Self-Hosting</summary>

</br>

![setup](/assets/doc/self-hosting.png)

## **Requirements**

- A clean server running **Ubuntu 22.04 or 24.04 LTS**
- **Root access** to the Server
- A **domain or subdomain** pointing to your server’s public IPv4

---

## Note

When **prompted**, simply **enter your domain or subdomain**. Then wait for the installation to complete.

```bash
# Install
wget -qO cme-install.sh https://docs.mirotalk.com/scripts/cme/cme-install.sh \
  && chmod +x cme-install.sh \
  && ./cme-install.sh
```

```bash
# Uninstall
wget -qO cme-uninstall.sh https://docs.mirotalk.com/scripts/cme/cme-uninstall.sh \
  && chmod +x cme-uninstall.sh \
  && ./cme-uninstall.sh
```

```bash
# Update
wget -qO cme-update.sh https://docs.mirotalk.com/scripts/cme/cme-update.sh \
  && chmod +x cme-update.sh \
  && ./cme-update.sh
```

</details>

---

## Fast Integration

![iframe](public/assets/iframe.png)

Easily integrate `Call-Me` into your website or application with a [simple iframe](https://codepen.io/Miroslav-Pejic/pen/qEWBaKP). Just add the following code to your project:

```html
<iframe
    allow="camera; microphone; speaker-selection; fullscreen; clipboard-read; clipboard-write; web-share; autoplay"
    src="https://cme.mirotalk.com/"
    style="width: 100vw; height: 100vh; border: 0px;"
></iframe>
```

---

## API

Get all connected users

```shell
# Get all connected users
curl -X GET "http://localhost:8000/api/v1/users" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json"
curl -X GET "https://cme.mirotalk.com/api/v1/users" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json"

# Generate call links for connected users to call
curl -X GET "http://localhost:8000/api/v1/connected?user=call-me" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json"
curl -X GET "https://cme.mirotalk.com/api/v1/connected?user=call-me" -H "authorization: call_me_api_key_secret" -H "Content-Type: application/json"
```

Docs: http://localhost:8000/api/v1/docs/ or you can check it out live in prod [here](https://cme.mirotalk.com/api/v1/docs/).

---

![Star History Chart](https://app.repohistory.com/api/svg?repo=miroslavpejic85/call-me&type=Date&background=0D1117&color=62C3F8)
