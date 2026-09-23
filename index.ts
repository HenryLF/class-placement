import index from "./src/index.html";

const server = Bun.serve({
  routes: {
    "/": index,
  },
  development: {
    // Bun 1.4.0's HMR bundler drops `*.module.css` imports
    // ("import_ClassRoom_module is not defined"), so HMR stays off.
    // `bun --watch` still restarts on changes; refresh the browser.
    hmr: false,
    console: true,
  },
});

console.log(`Dev server running at ${server.url}`);
