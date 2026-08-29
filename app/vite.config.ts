import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages는 https://<user>.github.io/<repo>/ 하위 경로로 서비스되므로
// 배포 빌드에서만 base를 저장소 이름으로 설정한다 (로컬 dev는 '/').
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
