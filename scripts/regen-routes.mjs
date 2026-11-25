// Regenerates src/routeTree.gen.ts without starting the dev server, then restores the Register block Start adds at runtime.
import { Generator, getConfig } from "@tanstack/router-generator";
import { readFileSync, writeFileSync } from "node:fs";
const file = "src/routeTree.gen.ts";
const old = readFileSync(file, "utf8");
const block = old.slice(old.indexOf("import type { getRouter }"));
const config = getConfig({ target: "react", routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts", autoCodeSplitting: false }, process.cwd());
await new Generator({ config, root: process.cwd() }).run();
let next = readFileSync(file, "utf8");
if (!next.includes("interface Register")) writeFileSync(file, next.trimEnd() + "\n\n" + block);
