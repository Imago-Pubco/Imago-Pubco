// Build du guide : impression Edge, relecture du PDF (pdfjs-dist), numéros du sommaire, vérification.
// Usage : PDFJS_DIR=<dossier hors dépôt contenant node_modules/pdfjs-dist> node docs/guide/build.mjs
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoDocs = resolve(here, "..");
const INDEX = join(here, "index.html");
const FINAL_PDF = join(repoDocs, "Imago-Guide-Utilisateur.pdf");
const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PDFJS = process.env.PDFJS_DIR;
if (!PDFJS) throw new Error("Définissez PDFJS_DIR vers un dossier hors dépôt où pdfjs-dist est installé (npm install pdfjs-dist@4.10.38).");
const { getDocument } = await import(pathToFileURL(join(PDFJS, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
const scratch = mkdtempSync(join(tmpdir(), "imago-guide-"));

// Edge rend la main avant la fin de l'impression lorsqu'il est lancé directement :
// on passe par PowerShell avec -Wait, ce qui attend réellement la fin du fichier PDF.
function printPdf(outPdf) {
  const args = ["--headless", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf=" + outPdf, pathToFileURL(INDEX).href];
  const ps = "$a = @(" + args.map((a) => "'" + a.replace(/'/g, "''") + "'").join(",") + "); " +
    "$p = Start-Process -FilePath '" + EDGE.replace(/'/g, "''") + "' -ArgumentList $a -PassThru -Wait -WindowStyle Hidden; exit $p.ExitCode";
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore", timeout: 170000 });
  if (!existsSync(outPdf)) throw new Error("PDF non produit : " + outPdf);
}
async function pageTexts(pdfPath) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((t) => t.str).join(" "));
  }
  return out;
}
const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
// Ligne du sommaire -> clé cherchée dans le texte des pages (en-tête de chapitre : « CHAPITRE n » suivi du titre)
function keyFor(n, title) {
  if (title.startsWith("Démarrer en 5 minutes")) return norm("Démarrage rapide" + title);
  if (/^\d+$/.test(n)) return norm("Chapitre" + n + title);
  return norm("Annexe" + n + title);
}
function firstPageWith(texts, key) {
  for (let i = 2; i < texts.length; i++) if (norm(texts[i]).includes(key)) return i + 1;
  return null;
}

// 1) Lignes du sommaire : chaque ligne reçoit un emplacement <span class="p">
let html = readFileSync(INDEX, "utf8");
const tocMatch = html.match(/<div class="toc2">[\s\S]*?<\/div>\s*<\/section>/);
if (!tocMatch) throw new Error("sommaire introuvable");
const rows = [];
const rowRe = /<li><span class="n">([^<]+)<\/span><span class="t">([^<]+)<\/span><span class="d">([^<]*)<\/span>(?:<span class="p">[^<]*<\/span>)?<\/li>/g;
const tocNew = tocMatch[0].replace(rowRe, (m, n, t, d) => {
  rows.push({ n, t });
  return `<li><span class="n">${n}</span><span class="t">${t}</span><span class="d">${d}</span><span class="p"></span></li>`;
});
if (!rows.length) throw new Error("aucune ligne de sommaire");
html = html.replace(tocMatch[0], tocNew);
writeFileSync(INDEX, html, "utf8");

// 2) Passe 1 : impression et relecture des pages
const pass1 = join(scratch, "pass1.pdf");
printPdf(pass1);
const t1 = await pageTexts(pass1);
const found = rows.map((r) => ({ ...r, page: firstPageWith(t1, keyFor(r.n, r.t)) }));
const missing = found.filter((f) => f.page === null).map((f) => f.t);
if (missing.length) throw new Error("titres introuvables : " + missing.join(", "));

// 3) Injection des numéros de page dans le sommaire
let k = 0;
html = readFileSync(INDEX, "utf8").replace(/<span class="p"><\/span>/g, () => `<span class="p">${found[k++].page}</span>`);
if (k !== found.length) throw new Error("injection incomplète");
writeFileSync(INDEX, html, "utf8");

// 4) Passe 2 : impression finale et vérification (sommaire = page relue, pied de page = index PDF)
printPdf(FINAL_PDF);
const t2 = await pageTexts(FINAL_PDF);
const problems = [];
for (const f of found) {
  const again = firstPageWith(t2, keyFor(f.n, f.t));
  if (again !== f.page) problems.push(`${f.t} : sommaire ${f.page}, relu ${again}`);
}
t2.forEach((txt, i) => {
  const m = txt.match(/Page (\d+)/);
  if (m && +m[1] !== i + 1) problems.push(`pied de page p.${i + 1} indique ${m[1]}`);
});
console.log(JSON.stringify({ pages: t2.length, tocEntries: found.length, toc: found.map((f) => f.t + "=" + f.page), problems }, null, 2));
if (problems.length) process.exitCode = 1;
