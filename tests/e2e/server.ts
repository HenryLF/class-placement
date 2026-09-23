// Starts the dev server (index.ts) on a free port for one test file.
import type { Subprocess } from "bun";

export interface TestServer {
  url: string;
  stop: () => void;
}

async function freePort() {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port!;
  probe.stop(true);
  return port;
}

export async function startServer(): Promise<TestServer> {
  const port = await freePort();
  const proc: Subprocess = Bun.spawn(["bun", "index.ts"], {
    cwd: `${import.meta.dir}/../..`,
    env: { ...process.env, BUN_PORT: String(port) },
    stdout: "ignore",
    // The dev server logs every bundle; a startup failure is reported below.
    stderr: "ignore",
  });
  const url = `http://localhost:${port}/`;

  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => proc.kill() };
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(100);
  }
  proc.kill();
  throw new Error(`Dev server didn't start on ${url}`);
}
