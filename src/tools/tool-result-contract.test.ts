import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const toolsDir = dirname(fileURLToPath(import.meta.url));

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function objectPropertyNames(node: ts.ObjectLiteralExpression): string[] {
  return node.properties.flatMap((property) => {
    if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
      const name = propertyName(property.name);
      return name ? [name] : [];
    }
    return [];
  });
}

function formatToolResultPayloads(fileName: string): Array<{ line: number; properties: string[] }> {
  const source = readFileSync(join(toolsDir, fileName), "utf8");
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const payloads: Array<{ line: number; properties: string[] }> = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === "formatToolResult" &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      payloads.push({
        line: line + 1,
        properties: objectPropertyNames(node.arguments[0]),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return payloads;
}

test("MCP tool results use summary + data + meta without legacy item/items aliases", () => {
  const files = readdirSync(toolsDir)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => file !== "registry.ts" && file !== "polymarket-shared.ts");

  const failures: string[] = [];
  let checkedPayloads = 0;

  for (const file of files) {
    for (const payload of formatToolResultPayloads(file)) {
      checkedPayloads += 1;
      const properties = new Set(payload.properties);
      for (const required of ["summary", "data", "meta"]) {
        if (!properties.has(required)) {
          failures.push(`${file}:${payload.line} missing ${required}`);
        }
      }
      for (const legacy of ["item", "items"]) {
        if (properties.has(legacy)) {
          failures.push(`${file}:${payload.line} returns legacy ${legacy}`);
        }
      }
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
  assert.ok(checkedPayloads > 0, "expected at least one tool result payload");
});
