import express from "express";
import compression from "compression";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());
app.use(express.static(join(__dirname, "dist/client")));
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist/client/index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`DEADSET running on port ${port}`));
