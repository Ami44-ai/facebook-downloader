# Facebook Video Downloader

A small Express app that downloads a Facebook video with `yt-dlp` and streams
the result to the browser.

## Requirements

- Node.js 18 or newer
- npm
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) installed and available on `PATH`

## Run locally

```powershell
npm ci
npm start
```

Open <http://localhost:4000>, paste an HTTPS Facebook or `fb.watch` video URL,
and submit the form. Set `PORT` in the process environment to use a different
port.

Each request downloads into a unique temporary directory. Temporary video files
are removed after the response completes or fails. Downloads are limited to
500 MB and ten minutes per request.

## Tests

```powershell
npm test
```

## Deployment notes

This is a minimal prototype, not a hardened public service. Do not expose it to
the public internet without adding authentication, rate limiting, and deployment
resource controls. Keep downloaded media and environment-specific configuration
out of Git. Only download videos you have permission to access and save.
