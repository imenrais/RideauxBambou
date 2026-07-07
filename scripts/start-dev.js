#!/usr/bin/env node

const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

async function killProcessOnPort(port) {
  try {
    // Find process using the port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);

    if (stdout) {
      const lines = stdout.trim().split("\n");
      const pids = new Set();

      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
          const pid = parts[4];
          if (pid && pid !== "0") {
            pids.add(pid);
          }
        }
      });

      // Kill all processes using the port
      for (const pid of pids) {
        try {
          console.log(`Killing process ${pid} on port ${port}...`);
          await execAsync(`taskkill /PID ${pid} /F`);
        } catch (error) {
          console.log(`Could not kill process ${pid}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`No processes found on port ${port}`);
  }
}

async function startDevServer() {
  try {
    console.log("Checking for processes on port 3000...");
    await killProcessOnPort(3000);

    console.log("Starting development server on port 3000...");
    const { stdout, stderr } = await execAsync("npm run dev");

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error("Error starting dev server:", error.message);
  }
}

startDevServer();



