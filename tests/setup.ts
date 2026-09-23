// Preloaded for unit tests only (see the "test" script): gives the stores a
// browser-like window, document and localStorage. E2E tests use real Chromium.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost/" });
