import * as ts from "typescript";
import type { Plugin } from "vite";

const PUBLIC_MODULE_ID = "virtual:bwc-static-html";
const RESOLVED_MODULE_ID = `\0${PUBLIC_MODULE_ID}`;
const BASE_HELPER_NAME = "__bwcStaticHtml";
// TS 6.0.3 internal TypeScriptTokenFlags.ContainsInvalidEscape: re-check this
// value on every TypeScript upgrade; "keeps invalid cooked escapes on the
// full runtime error path" pins it.
const CONTAINS_INVALID_ESCAPE_FLAG = 1 << 11;

type Replacement = {
  end: number;
  start: number;
  text: string;
};

// Single-file binder: noResolve plus a host serving only this source keeps
// cross-file and lib lookups out so isolated modules resolve alone.
function programFor(source: ts.SourceFile): ts.Program {
  const host: ts.CompilerHost = {
    fileExists: (fileName) => fileName === source.fileName,
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "",
    getNewLine: () => "\n",
    getSourceFile: (fileName) => (fileName === source.fileName ? source : undefined),
    readFile: (fileName) => (fileName === source.fileName ? source.text : undefined),
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };

  return ts.createProgram(
    [source.fileName],
    { noResolve: true, target: ts.ScriptTarget.ESNext },
    host,
  );
}

function applyReplacements(source: string, replacements: Replacement[]): string {
  let output = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
  }
  return output;
}

function referencedSymbol(node: ts.Identifier, checker: ts.TypeChecker): ts.Symbol | undefined {
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return checker.getShorthandAssignmentValueSymbol(parent);
  }
  if (ts.isExportSpecifier(parent)) {
    return checker.getExportSpecifierLocalTargetSymbol(parent);
  }
  return checker.getSymbolAtLocation(node);
}

// Any non-static use keeps the entire module unchanged so the public html contract remains available.
// Invalid cooked escapes also stay on the source runtime's error path.
export function compileStaticHtmlTemplates(source: string, id: string): string | null {
  const fileName = id.replace(/\?.*$/, "");
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const program = programFor(sourceFile);
  const checker = program.getTypeChecker();
  const importedBindings: Array<{
    declaration: ts.ImportDeclaration;
    specifier: ts.ImportSpecifier;
    symbol: ts.Symbol;
  }> = [];

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "microfw" ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }

    for (const specifier of statement.importClause.namedBindings.elements) {
      if ((specifier.propertyName?.text ?? specifier.name.text) !== "html") continue;
      const symbol = checker.getSymbolAtLocation(specifier.name);
      if (!symbol) return null;
      importedBindings.push({ declaration: statement, specifier, symbol });
    }
  }

  if (importedBindings.length === 0) return null;

  const identifiers = new Set<string>();
  const replacements: Replacement[] = [];
  const transformedSpecifiers = new Set<ts.ImportSpecifier>();
  let unsupported = false;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "eval"
    ) {
      unsupported = true;
    }

    for (const binding of importedBindings) {
      if (!ts.isIdentifier(node) || referencedSymbol(node, checker) !== binding.symbol) continue;
      if (node === binding.specifier.name) continue;

      const parent = node.parent;
      if (!ts.isTaggedTemplateExpression(parent) || parent.tag !== node) {
        unsupported = true;
        continue;
      }
      if (!ts.isNoSubstitutionTemplateLiteral(parent.template)) {
        unsupported = true;
        continue;
      }
      const templateFlags = (
        parent.template as ts.NoSubstitutionTemplateLiteral & { templateFlags?: number }
      ).templateFlags;
      if (templateFlags && (templateFlags & CONTAINS_INVALID_ESCAPE_FLAG) !== 0) {
        unsupported = true;
        continue;
      }

      replacements.push({
        start: parent.getStart(sourceFile),
        end: parent.end,
        text: `${BASE_HELPER_NAME}(${JSON.stringify(parent.template.text)})`,
      });
      transformedSpecifiers.add(binding.specifier);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (
    unsupported ||
    transformedSpecifiers.size !== importedBindings.length ||
    identifiers.has(BASE_HELPER_NAME)
  ) {
    return null;
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  for (const declaration of new Set(importedBindings.map((binding) => binding.declaration))) {
    const clause = declaration.importClause!;
    const bindings = clause.namedBindings as ts.NamedImports;
    const elements = bindings.elements.filter((specifier) => !transformedSpecifiers.has(specifier));
    let text = "";
    if (elements.length > 0 || clause.name) {
      const updatedClause = ts.factory.updateImportClause(
        clause,
        clause.phaseModifier,
        clause.name,
        elements.length > 0 ? ts.factory.updateNamedImports(bindings, elements) : undefined,
      );
      text = printer.printNode(
        ts.EmitHint.Unspecified,
        ts.factory.updateImportDeclaration(
          declaration,
          declaration.modifiers,
          updatedClause,
          declaration.moduleSpecifier,
          declaration.attributes,
        ),
        sourceFile,
      );
    }
    replacements.push({ start: declaration.getStart(sourceFile), end: declaration.end, text });
  }

  return `import { staticHtml as ${BASE_HELPER_NAME} } from ${JSON.stringify(PUBLIC_MODULE_ID)};\n${applyReplacements(source, replacements)}`;
}

export function staticHtmlPlugin(): Plugin {
  return {
    name: "bwc-static-html",
    apply: "build",
    enforce: "pre",
    resolveId(id) {
      if (id === PUBLIC_MODULE_ID) return RESOLVED_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_MODULE_ID) return;
      return `export function staticHtml(markup){const template=document.createElement("template");template.innerHTML=markup;return{fragment:template.content,bind:()=>()=>{}}}`;
    },
    transform: {
      filter: { id: /\.[cm]?[jt]sx?(?:\?.*)?$/ },
      handler(source, id) {
        const code = compileStaticHtmlTemplates(source, id);
        return code === null ? null : { code, map: null };
      },
    },
  };
}
