import fs from "fs";
import path from "path";
import { ZipArchive } from "archiver";

const outputPath = path.resolve("frontend-deploy.zip");
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

const output = fs.createWriteStream(outputPath);
const archive = new ZipArchive({
  zlib: { level: 9 },
});

output.on("close", () => {
  console.log(
    `frontend-deploy.zip created successfully with POSIX permissions: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`
  );
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);

function addDirectoryRecursive(dirPath, zipPrefix) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const zipPath = path.join(zipPrefix, item).replace(/\\/g, "/");
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      archive.append(null, { name: zipPath + "/", mode: 0o755 });
      addDirectoryRecursive(fullPath, zipPath);
    } else {
      archive.file(fullPath, { name: zipPath, mode: 0o644 });
    }
  }
}

// Add directories with explicit 0755 directory mode and 0644 file mode
archive.append(null, { name: "src/", mode: 0o755 });
addDirectoryRecursive("src", "src");

archive.append(null, { name: "public/", mode: 0o755 });
addDirectoryRecursive("public", "public");

const filesToAdd = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "eslint.config.js",
  ".prettierrc",
];

for (const file of filesToAdd) {
  if (fs.existsSync(file)) {
    archive.file(file, { name: file, mode: 0o644 });
  }
}

archive.finalize();
