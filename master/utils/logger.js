import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.resolve(__dirname, "..", "logs");
const logFilePath = path.join(logsDir, "app.log");

const ensureLogPath = () => {
  fs.mkdirSync(logsDir, { recursive: true });
};

const writeLog = (message) => {
  ensureLogPath();
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
};

const writeError = (message) => {
  ensureLogPath();
  const line = `[${new Date().toISOString()}] ERROR: ${message}`;
  console.error(line);
  fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
};

export default {
  log: writeLog,
  error: writeError,
};
