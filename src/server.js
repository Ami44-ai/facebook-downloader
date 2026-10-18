const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const app = express();
const execFileAsync = promisify(execFile);
const port = Number(process.env.PORT || 4000);
const downloadTimeoutMs = 10 * 60 * 1000;
const maxDownloadSize = "500M";
const maxUrlLength = 2048;

app.use(express.urlencoded({ extended: false, limit: "8kb" }));
app.use(express.json({ limit: "8kb" }));

app.use(express.static(path.join(__dirname, "..", "public")));

function isFacebookVideoUrl(value) {
  if (typeof value !== "string" || value.length > maxUrlLength) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isFacebookHost =
      hostname === "facebook.com" ||
      hostname.endsWith(".facebook.com") ||
      hostname === "fb.watch" ||
      hostname.endsWith(".fb.watch");

    return url.protocol === "https:" && !url.username && !url.password && isFacebookHost;
  } catch {
    return false;
  }
}

async function downloadVideoFromUrl(url) {
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "fbdown-"));

  try {
    await execFileAsync("yt-dlp", [
      "--no-warnings",
      "--restrict-filenames",
      "--no-playlist",
      "--max-filesize", maxDownloadSize,
      "--format", "best[ext=mp4]/best",
      "--output", path.join(workingDir, "%(title)s.%(ext)s"),
      url,
    ], {
      timeout: downloadTimeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    const files = await fs.readdir(workingDir, { withFileTypes: true });
    const downloadedFile = files.find((file) =>
      file.isFile() && /\.(mp4|m4v|webm|mkv|mov)$/i.test(file.name)
    );

    if (!downloadedFile) {
      throw new Error("yt-dlp completed without producing a video file.");
    }

    return {
      filePath: path.join(workingDir, downloadedFile.name),
      workingDir,
    };
  } catch (error) {
    await removeWorkingDir(workingDir);
    throw error;
  }
}

async function removeWorkingDir(workingDir) {
  try {
    await fs.rm(workingDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to remove temporary download files:", error);
  }
}

app.post("/download", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!isFacebookVideoUrl(url)) {
    return res.status(400).json({
      error: "Provide a valid HTTPS Facebook or fb.watch video URL.",
    });
  }

  let download;
  try {
    download = await downloadVideoFromUrl(url);
  } catch (error) {
    console.error("Video download failed:", error);
    return res.status(502).json({ error: "The video could not be downloaded." });
  }

  res.download(download.filePath, path.basename(download.filePath), (error) => {
    if (error) {
      console.error("Failed to send downloaded video:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to send the downloaded video." });
      }
    }
    void removeWorkingDir(download.workingDir);
  });
});

if (require.main === module) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  app.listen(port, () => {
    console.log("FBDown running on port:", port);
  });
}

module.exports = { app, isFacebookVideoUrl };
