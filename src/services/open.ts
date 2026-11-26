import { run } from "./exec";

/** Open a URL in the default browser (macOS `open`, Linux `xdg-open`). */
export const openUrl = (url: string) => run([process.platform === "darwin" ? "open" : "xdg-open", url]);
