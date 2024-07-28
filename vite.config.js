import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import restart from 'vite-plugin-restart'
import { resolve } from 'path'

export default defineConfig({
    root: 'src/', // Sources files (typically where index.html is)
    publicDir: '../public/', // Path from "root" to static assets (files that are served as they are)
    server: {
        host: true, // Open to local network and display URL
    },
    build: {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true, // Add sourcemap
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
            }
        }
    },
    plugins: [
        restart({ restart: ['../public/**'] }), // Restart server on static file change
        glsl()
    ],
})
