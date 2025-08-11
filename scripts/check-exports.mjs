import ts from "typescript";
import fs from "fs";

const cfg = JSON.parse(fs.readFileSync("contracts/exports.json", "utf8"));
const failures = [];

function collectExports(file) {
  const text = fs.readFileSync(file, "utf8");
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const actual = new Set();

  function visit(node) {
    const mods = node.modifiers || [];
    const isExported = mods.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (isExported) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(d => {
          if (d.name && d.name.getText) actual.add(d.name.getText());
        });
      } else if (node.name && node.name.getText) {
        actual.add(node.name.getText());
      }
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach(e => actual.add(e.name.getText()));
    }
    ts.forEachChild(node, visit);
  }
  visit(src);
  return actual;
}

for (const [file, expected] of Object.entries(cfg.files)) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: file missing`);
    continue;
  }
  const actual = collectExports(file);
  expected.forEach(name => {
    if (!actual.has(name)) failures.push(`${file}: missing export "${name}"`);
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
} else {
  console.log("Export names OK");
}
