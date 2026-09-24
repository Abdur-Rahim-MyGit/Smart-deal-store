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

// Add directories with explicit 0755 directory mode and 0644 file mode
archive.directory("src/", "src", { mode: 0o644 });
archive.directory("public/", "public", { mode: 0o644 });

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
