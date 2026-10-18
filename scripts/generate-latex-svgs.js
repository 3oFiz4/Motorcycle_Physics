// this file here only generate latex math svg icons
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root_dir = path.resolve(__dirname, "..");
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const html = mathjax.document("", {
  InputJax: new TeX({ packages: ["base", "ams"] }),
  OutputJax: new SVG({ fontCache: "none" }),
});
const symbols = {
  delta: "\\delta",
  phi: "\\phi",
  "minus-delta": "-\\delta",
  "plus-delta": "+\\delta",
  a_x: "a_x",
  a_y: "a_y",
  psi_dot: "\\dot{\\psi}",
  r_eq_psi_dot: "r = \\dot{\\psi}",
  atan_ay_g: "\\arctan(a_y/g)",
  psi: "\\psi",
};
const out_dir = path.join(root_dir, "assets", "latex");
if (!fs.existsSync(out_dir)) fs.mkdirSync(out_dir, { recursive: true });

//we then convert all math items in linq style chain
Object.entries(symbols).forEach(([name, tex]) => {
  try {
    const node = html.convert(tex, { display: false });
    let svg = adaptor.innerHTML(node);
    svg = svg.replace(/<svg /, '<svg fill="currentColor" ');
    fs.writeFileSync(path.join(out_dir, `${name}.svg`), svg, "utf8");
  } catch (err) {
    throw new Error(`cannot render latex: ${name} -> ${err.message}`);
  }
});
