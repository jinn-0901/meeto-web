# Meeto Web

> **Meet without limits.** A browser-first video meeting experience built around simple, uninterrupted conversations.

Meeto is a web-based meeting project. This repository contains the React interface; the backend lives in [meeto-server](https://github.com/jinn-0901/meeto-server). The project is under active development: the current page is a working UI scaffold with an API health check, not a finished video-calling service.

## At a glance

| | |
| --- | --- |
| Framework | React |
| Language | JavaScript (ES modules) |
| Development/build tooling | Create React App (react-scripts) |
| Realtime client dependency | Socket.IO Client |
| API check | GET /api/health |
| Status | Early development scaffold |

## Project structure

\`\`\`text
meeto-web/
├── public/
│   ├── favicon.svg
│   └── index.html
├── src/
│   ├── lib/
│   │   └── api.js
│   ├── App.js
│   ├── index.js
│   └── styles.css
├── .env.example
├── .gitignore
└── package.json
\`\`\`

## Run locally

**Requirements:** Node.js and npm.

\`\`\`bash
git clone https://github.com/jinn-0901/meeto-web.git
cd meeto-web
npm install
\`\`\`

Create a local .env file from .env.example if you need to change the API address:

\`\`\`env
REACT_APP_API_BASE_URL=http://localhost:4000
\`\`\`

Start the development server:

\`\`\`bash
npm start
\`\`\`

The app opens at [http://localhost:3000](http://localhost:3000).

## Connect to the server

Run [Meeto Server](https://github.com/jinn-0901/meeto-server) separately. The default API address is http://localhost:4000. Use **Test connection** on the page to call GET /api/health.

Environment variables prefixed with REACT_APP_ are included in the browser bundle. **Never put private keys, passwords, or server secrets in the web app environment.**

## What's implemented?

- Responsive landing page and illustrative meeting preview.
- API health-check button with connection status.
- Separate web and server repositories.

## What's planned?

- Create and join meetings using shareable links.
- Camera and microphone preview and controls.
- Participant presence and Socket.IO signaling.
- WebRTC audio/video, with an appropriate relay/media architecture for larger calls.
- Accessibility, reconnect handling, and clearer permission/error states.

These are planned features, not currently available functionality. “No arbitrary free-meeting time cap” is a product goal; actual service limits will depend on infrastructure, fair-use safeguards, and operating costs.

## Useful scripts

| Command | Purpose |
| --- | --- |
| npm start | Start the local development server |
| npm test | Run the test runner |
| npm run build | Create a production build |

## Related repository

- [Meeto Server](https://github.com/jinn-0901/meeto-server) — Express API and Socket.IO foundation.

## License

No license has been specified yet. Contact the repository owner before reusing this project.
