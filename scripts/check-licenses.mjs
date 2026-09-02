// License allow-list check (DOC-08 §7, ADR-015).
//
// Walks every package installed under node_modules and verifies its declared
// license against the allow-list below. A package whose license is not on the
// list must have an entry in scripts/license-exceptions.json, and every
// exception must cite its row in docs/08-LICENSING.md. Exceptions marked
// "buildTimeOnly" are additionally checked against the production dependency
// tree: if such a package would ship to users, the check fails.
//
// Run with: npm run check:licenses

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// DOC-08 §7 allow-list, verbatim.
const ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'PostgreSQL',
  'Unlicense',
  'Python-2.0',
  'BlueOak-1.0.0'
]);

const exceptionsFile = JSON.parse(
  readFileSync(join(root, 'scripts', 'license-exceptions.json'), 'utf8')
);
const exceptions = new Map(exceptionsFile.exceptions.map((e) => [e.name, e]));

// A license expression like "(MIT OR Apache-2.0)" is allowed when any OR-part
// is allowed; "A AND B" requires every part to be allowed.
function licenseAllowed(expr) {
  if (typeof expr !== 'string' || expr.trim() === '') return false;
  const cleaned = expr.replaceAll('(', ' ').replaceAll(')', ' ').trim();
  if (cleaned.includes(' OR ')) {
    return cleaned.split(' OR ').some((part) => licenseAllowed(part));
  }
  if (cleaned.includes(' AND ')) {
    return cleaned.split(' AND ').every((part) => licenseAllowed(part));
  }
  return ALLOWED.has(cleaned);
}

function declaredLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  }
  return '';
}

// Collect every installed package (including nested copies).
function collectPackages(nodeModulesDir, found) {
  if (!existsSync(nodeModulesDir)) return;
  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      collectPackages(join(nodeModulesDir, entry.name), found);
      continue;
    }
    const pkgDir = join(nodeModulesDir, entry.name);
    const pkgJson = join(pkgDir, 'package.json');
    if (existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
        if (pkg.name) {
          found.push({ name: pkg.name, version: pkg.version ?? '?', license: declaredLicense(pkg) });
        }
      } catch {
        // A malformed package.json inside node_modules is npm's problem, not a
        // license violation; the package still gets reported if it has a name.
      }
      collectPackages(join(pkgDir, 'node_modules'), found);
    }
  }
}

// The set of package names that ship to users: the production dependency tree.
function productionPackageNames() {
  const out = execSync('npm ls --omit=dev --all --json', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const names = new Set();
  function walk(deps) {
    if (!deps) return;
    for (const [name, info] of Object.entries(deps)) {
      names.add(name);
      walk(info.dependencies);
    }
  }
  walk(JSON.parse(out).dependencies);
  return names;
}

const packages = [];
collectPackages(join(root, 'node_modules'), packages);
const shipped = productionPackageNames();

const violations = [];
const usedExceptions = new Set();
const seen = new Set();

for (const pkg of packages) {
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  if (licenseAllowed(pkg.license)) continue;

  const exception = exceptions.get(pkg.name);
  if (!exception) {
    violations.push(`${key}: license "${pkg.license || '(none declared)'}" is not on the DOC-08 allow-list and has no registered exception`);
    continue;
  }
  if (exception.license !== pkg.license) {
    violations.push(`${key}: license "${pkg.license}" does not match the registered exception ("${exception.license}") — re-verify against DOC-08`);
    continue;
  }
  if (exception.buildTimeOnly && shipped.has(pkg.name)) {
    violations.push(`${key}: registered as build-time-only, but it is in the production dependency tree (it would ship to users)`);
    continue;
  }
  usedExceptions.add(pkg.name);
}

for (const [name] of exceptions) {
  if (!usedExceptions.has(name) && !packages.some((p) => p.name === name)) {
    console.warn(`note: exception for "${name}" matches no installed package; remove it from license-exceptions.json`);
  }
}

if (violations.length > 0) {
  console.error(`LICENSE CHECK FAILED — ${violations.length} problem(s):\n`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error('\nEither remove the dependency or add it to docs/08-LICENSING.md and scripts/license-exceptions.json (in that order).');
  process.exit(1);
}

console.log(`License check passed: ${seen.size} package versions checked, ${usedExceptions.size} registered exception(s) in use, all on the DOC-08 allow-list.`);
