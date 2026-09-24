import fs from "node:fs";
fs.cpSync("node_modules/@excalidraw/excalidraw/dist/prod/fonts", "dist/fonts", {
  recursive: true,
});
