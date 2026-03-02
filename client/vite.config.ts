import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    host: true, // listen on 0.0.0.0 so Docker port mapping works
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
