import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Electron이 dist/index.html을 file:// 프로토콜로 직접 열기 때문에, 절대경로("/assets/...")가
  // 아니라 상대경로("./assets/...")로 빌드해야 자산을 찾을 수 있다(웹 배포에서도 상대경로는 문제없이 동작한다).
  base: "./",
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8790",
      "/generated-images": "http://localhost:8790",
    },
  },
});
