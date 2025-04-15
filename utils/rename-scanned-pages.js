const fs = require("fs");
const path = require("path");

const directoryPath = process.argv[2]; // Usage: node rename-scanned-pages.js ./path/to/folder

if (!directoryPath) {
  console.error("Please provide a folder path with scanned images.");
  process.exit(1);
}

fs.readdir(directoryPath, async (err, files) => {
  if (err) {
    return console.error("Error reading directory:", err);
  }

  const jpgFiles = files
    .filter(f => f.toLowerCase().endsWith(".jpg"))
    .map(f => {
      const fullPath = path.join(directoryPath, f);
      const stats = fs.statSync(fullPath);
      return {
        originalName: f,
        fullPath,
        createdAt: stats.birthtimeMs || stats.ctimeMs,
      };
    })
    //.sort((a, b) => a.createdAt - b.createdAt);
    .sort((a, b) => b.createdAt - a.createdAt); // ← for newest first

  jpgFiles.forEach((file, index) => {
    const newName = `pg${index + 1}.jpg`;
    const newPath = path.join(directoryPath, newName);
    fs.renameSync(file.fullPath, newPath);
    console.log(`Renamed ${file.originalName} → ${newName}`);
  });

  console.log(`✅ Renamed ${jpgFiles.length} files.`);
});
