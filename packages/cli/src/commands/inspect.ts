import type { Example } from "./_examples.js";
import { createInspectCommand } from "./layout.js";

export const examples: Example[] = [
  ["Inspect visual layout across the current composition", "frames inspect"],
  ["Inspect a specific project", "frames inspect ./my-video"],
  ["Output agent-readable JSON", "frames inspect --json"],
  ["Use explicit hero-frame timestamps", "frames inspect --at 1.5,4.0,7.25"],
  [
    "Also sample at tween boundaries to catch transient overlaps",
    "frames inspect --at-transitions",
  ],
  [
    "Verify motion intent (add a *.motion.json sidecar next to the composition)",
    "frames inspect --json",
  ],
  ["Run the compatibility alias", "frames layout --json"],
];

export default createInspectCommand("inspect");
