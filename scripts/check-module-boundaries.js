#!/usr/bin/env node

/**
 * Enforce the source dependency direction documented in
 * docs/architecture/module-boundaries.md according to AD-004.
 *
 * Uses TypeScript AST and module resolution to check imports/exports.
 * Checks production source only; test code and test-support are excluded
 * from production build and tested separately.
 *
 * Layers (AD-004): app -> features -> ui -> core, plus `test` for test-only
 * code. Production code must never import `test`. A feature may import another
 * feature only through that feature's public barrel (`index.ts`); for the
 * `lesson` feature the three sub-parts (`library`, `player`, `packages`) are
 * themselves public barrels.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(appRoot, 'src');
const defaultManifestPath = path.join(
  __dirname,
  'module-boundary-exceptions.json',
);

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const assetExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.json',
  '.ttf',
  '.otf',
  '.webp',
  '.mp3',
  '.wav',
];

// app may import features, features/ui/core, ui may import core, core may
// import core. Lower rank may never import a higher rank.
const LAYER_RANK = {
  app: 0,
  features: 1,
  ui: 2,
  core: 3,
};

const LESSON_SUB_PARTS = ['library', 'player', 'flow'];

function loadCompilerOptions(rootDir = appRoot) {
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return {};
  }
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Error reading tsconfig.json: ${configFile.error.messageText}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    rootDir,
  );
  return parsed.options;
}

function walkSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Exclude test folders and test-support from production scanning.
      if (
        entry.name === '__tests__' ||
        entry.name === 'test-support' ||
        entry.name === 'test' ||
        entry.name === 'test-utils'
      ) {
        return [];
      }
      return walkSourceFiles(entryPath);
    }
    if (!sourceExtensions.includes(path.extname(entry.name))) return [];
    if (/(\.test\.|\.spec\.)/.test(entry.name)) return [];
    return [entryPath];
  });
}

function normalizePath(filePath) {
  return path.relative(appRoot, filePath).split(path.sep).join('/');
}

function sourceLayer(filePath, srcRoot = sourceRoot) {
  const relative = path.relative(srcRoot, filePath).split(path.sep).join('/');
  if (relative.startsWith('..')) {
    return {layer: 'external', feature: null, rel: relative};
  }
  const parts = relative.split('/');
  const layer = parts[0];
  const feature = layer === 'features' ? parts[1] || null : null;
  return {layer, feature, rel: relative};
}

function isTestTarget(targetFile) {
  return (
    /(^|\/)(__tests__|test-support|test-utils)(\/|$)/.test(targetFile) ||
    /(^|\/)test\//.test(targetFile) ||
    /(\.test\.|\.spec\.)/.test(targetFile)
  );
}

/**
 * True when the resolved target is a public barrel of a feature:
 * `features/<f>/index.ts(x)` for every feature, plus the three public
 * sub-part barrels `features/lesson/<part>/index.ts(x)`.
 */
function isPublicFeatureBarrel(target) {
  if (!target || target.layer !== 'features' || !target.feature) {
    return false;
  }
  const parts = target.rel.split('/');
  const isIndex = fileName => /^index\.(ts|tsx|js|jsx)$/.test(fileName);
  if (parts.length === 3) {
    return isIndex(parts[2]);
  }
  if (
    target.feature === 'lesson' &&
    parts.length === 4 &&
    LESSON_SUB_PARTS.includes(parts[2]) &&
    isIndex(parts[3])
  ) {
    return true;
  }
  return false;
}

/**
 * DEC-3: `app` may import `features/<f>/screens/*UiPort.ts(x)` in addition to
 * the feature barrel.
 */
function isUiPort(target) {
  if (!target || target.layer !== 'features' || !target.feature) {
    return false;
  }
  const parts = target.rel.split('/');
  if (parts.length !== 4 || parts[2] !== 'screens') return false;
  return /UiPort\.(ts|tsx|js|jsx)$/.test(parts[3]);
}

function findImportsInSource(filePath, content) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const literalImports = [];
  const nonLiteralImports = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          literalImports.push({
            specifier: node.moduleSpecifier.text,
            line,
            kind: ts.isImportDeclaration(node) ? 'import' : 'export',
          });
        } else {
          nonLiteralImports.push({
            expression: node.moduleSpecifier.getText(sourceFile),
            line,
            kind: 'non-literal-module-specifier',
          });
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (
        node.moduleReference &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        literalImports.push({
          specifier: node.moduleReference.expression.text,
          line,
          kind: 'import-equals',
        });
      }
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          literalImports.push({
            specifier: arg.text,
            line,
            kind: isDynamicImport ? 'dynamic-import' : 'require',
          });
        } else if (arg) {
          nonLiteralImports.push({
            expression: arg.getText(sourceFile),
            line,
            kind: isDynamicImport
              ? 'non-literal-import'
              : 'non-literal-require',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {literalImports, nonLiteralImports};
}

function resolveSpecifier(
  specifier,
  containingFile,
  compilerOptions,
  _srcRoot = sourceRoot,
) {
  const ext = path.extname(specifier).toLowerCase();
  if (assetExtensions.includes(ext)) {
    return {resolvedFileName: specifier, isAsset: true};
  }

  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
  );
  if (result && result.resolvedModule) {
    return {
      resolvedFileName: result.resolvedModule.resolvedFileName,
      isExternal: Boolean(result.resolvedModule.isExternalLibraryImport),
      isAsset: false,
    };
  }

  if (specifier.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(containingFile), specifier);
    const resolvedExt = path.extname(resolvedPath).toLowerCase();
    if (assetExtensions.includes(resolvedExt)) {
      return {resolvedFileName: resolvedPath, isAsset: true};
    }
  }

  return null;
}

function checkImportRules(
  fromFile,
  importItem,
  resolvedTarget,
  srcRoot = sourceRoot,
) {
  if (!resolvedTarget || resolvedTarget.isAsset || resolvedTarget.isExternal) {
    return [];
  }

  const targetFile = resolvedTarget.resolvedFileName;
  const source = sourceLayer(fromFile, srcRoot);
  const target = sourceLayer(targetFile, srcRoot);

  if (target.layer === 'external') {
    return [];
  }

  const violations = [];
  const specifier = importItem.specifier;
  const line = importItem.line;

  // Rule: production-to-test
  if (isTestTarget(normalizePath(targetFile))) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'production-to-test',
      description: 'production code must not import test-support or test files',
    });
    return violations;
  }

  const sourceRank = LAYER_RANK[source.layer];
  const targetRank = LAYER_RANK[target.layer];

  // Rule: upward import between ordered layers (core-to-features, core-to-app,
  // core-to-ui, ui-to-features, ui-to-app, features-to-app, ...).
  if (
    sourceRank !== undefined &&
    targetRank !== undefined &&
    targetRank < sourceRank
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: `${source.layer}-to-${target.layer}`,
      description: `${source.layer} must not depend on ${target.layer}`,
    });
  }

  // Rule: app-to-feature-private
  if (
    source.layer === 'app' &&
    target.layer === 'features' &&
    !isPublicFeatureBarrel(target) &&
    !isUiPort(target)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'app-to-feature-private',
      description:
        'app composition must import a feature public barrel (@features/<feature>) or a screens/*UiPort',
    });
  }

  // Rule: cross-feature-private (feature -> different feature)
  if (
    source.layer === 'features' &&
    target.layer === 'features' &&
    source.feature !== target.feature &&
    !isPublicFeatureBarrel(target)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'cross-feature-private',
      description:
        'cross-feature imports must use the target feature barrel (@features/<feature>)',
    });
  }

  return violations;
}

/**
 * Navigation rules (navigation redesign): feature code navigates through
 * `useAppNavigation()` intents from `@core/navigation`, never by reaching
 * into a parent navigator or by naming an unregistered route.
 *
 * - `feature-navigation-get-parent`: any `.getParent(...)` call in
 *   `src/features` (reaching into the tab/root navigator from a screen is
 *   what made flows land in the wrong tab).
 * - `navigation-untyped-route`: `navigate(<route> as any, ...)` anywhere in
 *   production source (it hid navigations to routes that do not exist).
 */
function checkNavigationRules(filePath, content, srcRoot = sourceRoot) {
  const source = sourceLayer(filePath, srcRoot);
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const violations = [];

  function report(node, rule) {
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    violations.push({
      file: normalizePath(filePath),
      line,
      specifier: node.getText(sourceFile).split('\n')[0].slice(0, 80),
      rule,
      description:
        rule === 'feature-navigation-get-parent'
          ? 'Use useAppNavigation() intents instead of getParent() in features'
          : 'Do not cast a route name to any; register the route instead',
    });
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      if (method === 'getParent' && source.layer === 'features') {
        report(node, 'feature-navigation-get-parent');
      }
      const firstArg = node.arguments[0];
      if (
        method === 'navigate' &&
        firstArg &&
        ts.isAsExpression(firstArg) &&
        firstArg.type.kind === ts.SyntaxKind.AnyKeyword
      ) {
        report(node, 'navigation-untyped-route');
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function loadExceptionManifest(manifestPath = defaultManifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return {exceptions: [], byKey: new Map(), allowanceByKey: new Map()};
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  const exceptions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.exceptions)
      ? parsed.exceptions
      : [];

  const byKey = new Map();
  const allowanceByKey = new Map();
  exceptions.forEach((entry, index) => {
    if (!entry.file || !entry.specifier || !entry.rule) {
      throw new Error(
        `Invalid manifest entry at index ${index}: missing file, specifier, or rule`,
      );
    }
    const key = `${entry.file}::${entry.specifier}::${entry.rule}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
    if (!allowanceByKey.has(key)) {
      allowanceByKey.set(key, []);
    }
    allowanceByKey.get(key).push(entry);
  });

  return {exceptions, byKey, allowanceByKey, rawParsed: parsed};
}

function checkModuleBoundaries(options = {}) {
  const rootDir = options.rootDir || appRoot;
  const srcDir = options.sourceDir || path.join(rootDir, 'src');
  const manifestPath = options.manifestPath || defaultManifestPath;
  const compilerOptions =
    options.compilerOptions || loadCompilerOptions(rootDir);

  const manifest = loadExceptionManifest(manifestPath);
  const files = options.files || walkSourceFiles(srcDir);

  const remainingAllowances = new Map();
  if (manifest.allowanceByKey) {
    for (const [key, entries] of manifest.allowanceByKey.entries()) {
      remainingAllowances.set(key, [...entries]);
    }
  }

  const detectedViolations = [];
  const manualReviewItems = [];
  const matchedExceptions = [];
  const newViolations = [];
  const expiredExceptions = [];

  for (const filePath of files) {
    const content =
      options.fileContents && options.fileContents[filePath] !== undefined
        ? options.fileContents[filePath]
        : fs.readFileSync(filePath, 'utf8');
    const {literalImports, nonLiteralImports} = findImportsInSource(
      filePath,
      content,
    );

    for (const nonLit of nonLiteralImports) {
      manualReviewItems.push({
        file: normalizePath(filePath),
        line: nonLit.line,
        expression: nonLit.expression,
        kind: nonLit.kind,
      });
    }

    const violations = checkNavigationRules(filePath, content, srcDir);
    for (const imp of literalImports) {
      const resolved = resolveSpecifier(
        imp.specifier,
        filePath,
        compilerOptions,
        srcDir,
      );
      violations.push(...checkImportRules(filePath, imp, resolved, srcDir));
    }
    for (const violation of violations) {
      detectedViolations.push(violation);

      const key = `${violation.file}::${violation.specifier}::${violation.rule}`;
      const queue = remainingAllowances.get(key);

      if (queue && queue.length > 0) {
        const manifestEntry = queue.shift();
        if (
          manifestEntry.expiry &&
          /^\d{4}-\d{2}-\d{2}/.test(manifestEntry.expiry)
        ) {
          const expiryDate = Date.parse(manifestEntry.expiry);
          if (!Number.isNaN(expiryDate) && Date.now() > expiryDate) {
            expiredExceptions.push({
              ...violation,
              owner: manifestEntry.owner,
              expiry: manifestEntry.expiry,
            });
            newViolations.push({
              ...violation,
              reason: `Exception expired at ${manifestEntry.expiry}`,
            });
            continue;
          }
        }
        matchedExceptions.push({
          ...violation,
          owner: manifestEntry.owner,
          expiry: manifestEntry.expiry,
        });
      } else {
        const hadAllowance =
          manifest.allowanceByKey && manifest.allowanceByKey.has(key);
        const maxAllowed = hadAllowance
          ? manifest.allowanceByKey.get(key).length
          : 0;
        newViolations.push({
          ...violation,
          reason: hadAllowance
            ? `Surplus occurrence exceeding manifest allowance (${maxAllowed} allowed)`
            : 'Not present in baseline manifest',
        });
      }
    }
  }

  const passed = newViolations.length === 0;

  return {
    passed,
    detectedViolations,
    matchedExceptions,
    newViolations,
    expiredExceptions,
    manualReviewItems,
    manifestTotal: manifest.exceptions.length,
    manifestPath,
  };
}

function runCli() {
  const result = checkModuleBoundaries();

  if (result.manualReviewItems.length > 0) {
    console.log(
      `[MANUAL REVIEW] ${result.manualReviewItems.length} non-literal import(s) detected:`,
    );
    for (const item of result.manualReviewItems) {
      console.log(
        `  ${item.file}:${item.line} ${item.kind}: ${item.expression}`,
      );
    }
  }

  if (result.newViolations.length > 0) {
    console.error(
      `Module boundary check failed: ${result.newViolations.length} new violation(s) found!`,
    );
    for (const v of result.newViolations) {
      console.error(
        `${v.file}:${v.line} imports ${v.specifier} — [${v.rule}] ${
          v.description || v.reason || ''
        }`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Module boundary check passed with zero new violations. (${result.matchedExceptions.length} active baseline exceptions allowed via manifest).`,
  );
}

if (require.main === module) {
  runCli();
}

module.exports = {
  checkModuleBoundaries,
  checkNavigationRules,
  findImportsInSource,
  resolveSpecifier,
  checkImportRules,
  isPublicFeatureBarrel,
  isUiPort,
  isTestTarget,
  sourceLayer,
  loadCompilerOptions,
  loadExceptionManifest,
  normalizePath,
};
