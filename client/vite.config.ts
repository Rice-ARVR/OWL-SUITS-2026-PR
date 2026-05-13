import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";

export default defineConfig({
    server: {
        host: true, // listen on 0.0.0.0 so Docker port mapping works
        proxy: {
            "/navigation": {
                target: "http://localhost:8000", // your FastAPI server
                changeOrigin: true,
            },
        },
    },
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), svgr()],
});
