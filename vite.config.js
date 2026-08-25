import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "jiep-digi-mh02-smartd-monitoring-system-frontend-production.up.railway.app",
    ],
  },
});
