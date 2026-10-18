const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { app, isFacebookVideoUrl } = require("../src/server");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("accepts HTTPS Facebook and fb.watch URLs", () => {
  assert.equal(isFacebookVideoUrl("https://www.facebook.com/watch/?v=123"), true);
  assert.equal(isFacebookVideoUrl("https://fb.watch/abc123/"), true);
});

test("rejects unsafe and malformed URLs", () => {
  assert.equal(isFacebookVideoUrl("http://facebook.com/video"), false);
  assert.equal(isFacebookVideoUrl("https://facebook.com.example.org/video"), false);
  assert.equal(isFacebookVideoUrl("https://example.org/video"), false);
  assert.equal(isFacebookVideoUrl("https://user:pass@facebook.com/video"), false);
  assert.equal(isFacebookVideoUrl("not a URL"), false);
  assert.equal(isFacebookVideoUrl(`https://facebook.com/${"a".repeat(2048)}`), false);
});

test("serves the downloader page", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Facebook Downloader/);
});

test("rejects non-Facebook download URLs before invoking yt-dlp", async () => {
  const response = await fetch(`${baseUrl}/download`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.org/video" }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Facebook/);
});
