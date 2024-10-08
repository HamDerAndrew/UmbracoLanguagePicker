import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "src/umbraco-language-picker.element.ts", // your web component source file
            formats: ["es"],
        },
        outDir: "dist", // your web component will be saved in this location
        sourcemap: true,
        rollupOptions: {
            external: [/^@umbraco/],
        },
    },
});