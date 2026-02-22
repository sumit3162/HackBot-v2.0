import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Tool Execution (since nmap might not be in the sandbox)
  // In a real environment, this would use child_process.exec
  app.post("/api/tools/nmap", (req, res) => {
    const { target, args } = req.body;
    console.log(`[Tool] Running nmap ${args} on ${target}`);
    
    // Simulate nmap output for demonstration
    const mockOutput = `
Starting Nmap 7.80 ( https://nmap.org ) at 2024-05-20 12:00 UTC
Nmap scan report for ${target}
Host is up (0.002s latency).
Not shown: 997 closed ports
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https

Nmap done: 1 IP address (1 host up) scanned in 0.50 seconds
    `;
    
    setTimeout(() => {
      res.json({ output: mockOutput });
    }, 1500);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HackBot v2.0 Server running on http://localhost:${PORT}`);
  });
}

startServer();
