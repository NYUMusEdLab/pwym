#!/usr/bin/env python3
"""Check the integrity and executable dependency policy of MusEDLab release surfaces."""
import argparse
from collections import deque
from datetime import date
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / 'scripts/release-exceptions.json'
MANIFEST = ROOT / 'scripts/release-sha256.json'
SCOPES = ('corpus-explorer/', 'experimental-tools/', 'rengongfu/', 'interfacestudies/continuator/',
          'interfacestudies/ai-music-lab/', 'interfacestudies/vendor/continuator/', 'playablescore/')
ENTRIES = {'interfacestudies/index.html'}
CODE = {'.js', '.mjs', '.cjs', '.css', '.html', '.htm'}
SECRET_NAME = re.compile(
    r'(?:^|/)(?:\.env(?:$|[./])|\.aws(?:/|$)|\.ssh(?:/|$)|\.npmrc$|\.netrc$|'
    r'id_(?:rsa|dsa|ecdsa|ed25519)(?:$|/)|(?:credentials|secrets)(?:\.(?:json|ya?ml|toml|ini|txt)|/|$)|'
    r'[^/]+\.(?:pem|p12|pfx|key|kdbx|jks|keystore)$)', re.I)
SECRET_BYTES = re.compile(
    rb'-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|'
    rb'\bgithub_pat_[A-Za-z0-9_]{35,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b')
ACTION = re.compile(r"^\s*(?:-\s*)?uses\s*:\s*['\"]?([^\s'\"#]+)", re.M)
PIN = re.compile(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}\Z')

# Deliberately recognize network-capable syntax, not links, musical data fetches,
# or upstream attribution text. Regex checking is not a complete JS parser.
LITERAL = r"""(['"`])([^'"`\n]+)\1"""
JS_DIRECT = tuple(re.compile(start + LITERAL, re.M) for start in (
    r"\b(?:import|export)\s+(?:[^;\n]*?\bfrom\s*)?",
    r"\bimport\s*\(\s*",
    r"\b(?:new\s+(?:Shared)?Worker\s*\(|serviceWorker\.register\s*\()\s*(?:new\s+URL\s*\(\s*)?",
    r"\b(?:script|scriptEl|scriptElement)\.src\s*=\s*",
))
IMPORT_SCRIPTS = re.compile(r'\bimportScripts\s*\(([^)]*)\)')
URL_BASE = re.compile(r"""\bconst\s+(?P<var>[A-Za-z_$][\w$]*)\s*=\s*new URL\(\s*(?P<quote>['"])(?P<base>[^'"]+)\2\s*,\s*self\.location\.href\s*\)""")
IMPORT_URL = re.compile(r"""\bimportScripts\s*\(\s*new URL\(\s*(?P<quote>['"])(?P<file>[^'"]+)\1\s*,\s*(?P<var>[A-Za-z_$][\w$]*)\s*\)\.href\s*\)""")
# The unchanged publisher's dual-environment Pyodide build has these exact
# Node-only compatibility imports (guarded on Node detection). They are
# neither browser URLs nor dependencies of the production release. New
# imports, modified bytes, or any remote URL still go through normal policy.
PYODIDE_ASM = 'interfacestudies/vendor/continuator/pyodide-0.28.3/pyodide.asm.js'
PYODIDE_ASM_SHA = 'b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56'
NODE_COMPAT = {'node:url', 'node:fs', 'node:fs/promises', 'node:vm', 'node:path',
               'node:crypto', 'node:child_process', 'ws'}
CSS_IMPORT = re.compile(r"""@import\s+(?:url\(\s*)?""" + LITERAL, re.I)
CSS_IMPORT_BARE = re.compile(r"@import\s+url\(\s*([^'\"\s)]+)", re.I)
REMOTE_LITERAL = re.compile(r"""(['"`])((?:https?:)?//[^'"`\n\s]+)\1""", re.I)
LIKELY_EXEC = re.compile(r"(?:\.(?:[mc]?js|wasm)(?:[?#]|$)|@latest(?:/|[?#]|$)|/gtag/js(?:[?#]|$))", re.I)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def track_paths():
    return subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().strip('\0').split('\0')


def js_refs(code):
    for pattern in JS_DIRECT:
        for match in pattern.finditer(code):
            yield match[2]
    bases = {m['var']: m['base'] for m in URL_BASE.finditer(code)}
    composed = {m.start(): m for m in IMPORT_URL.finditer(code)}
    for m in IMPORT_SCRIPTS.finditer(code):
        if m.start() in composed:
            url = composed[m.start()]
            base = bases.get(url['var'])
            if base is None:
                raise ValueError('script uses an unresolved executable URL base')
            child = url['file']
            if urlsplit(child).scheme or child.startswith('//'):
                yield child
            else:
                # Preserve any scheme/network location on the base for rejection.
                yield base.rstrip('/') + '/' + child
        else:
            for item in re.finditer(LITERAL, m[1]):
                yield item[2]
    for match in REMOTE_LITERAL.finditer(code):
        if LIKELY_EXEC.search(match[2]):
            yield match[2]


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.inline = False

    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if tag == 'base' and a.get('href'):
            raise ValueError('base href changes the resolution of protected dependencies')
        if tag == 'script':
            self.inline = not a.get('src') and (a.get('type') or '').lower() in {
                '', 'module', 'application/javascript', 'text/javascript', 'importmap'
            }
            if a.get('src'):
                self.refs.append(a['src'])
        if tag == 'link' and a.get('href'):
            rel = (a.get('rel') or '').lower().split()
            if set(rel) & {'stylesheet', 'modulepreload'} or 'preload' in rel and a.get('as') in {'script', 'worker', 'style'}:
                self.refs.append(a['href'])
        # Embedded documents can execute outside this local dependency graph.
        if tag in {'iframe', 'object', 'embed'} and (a.get('src') or a.get('data') or a.get('srcdoc')):
            raise ValueError('embedded active document requires scoped review')

    def handle_endtag(self, tag):
        if tag == 'script':
            self.inline = False

    def handle_data(self, data):
        if self.inline:
            self.refs.extend(js_refs(data))
            for m in re.finditer(r"""['"](https?://[^'"]+)['"]""", data):
                if re.search(r'(?:\.m?js(?:[?#]|$)|/npm/|@latest)', m[1], re.I):
                    self.refs.append(m[1])


def references(path, raw):
    suffix = PurePosixPath(path).suffix.lower()
    if suffix not in CODE:
        return []
    content = raw.decode('utf-8')
    if suffix in {'.html', '.htm'}:
        p = Page()
        p.feed(content)
        p.close()
        return p.refs
    if suffix == '.css':
        return [m[2] for m in CSS_IMPORT.finditer(content)] + CSS_IMPORT_BARE.findall(content)
    return list(js_refs(content))


def scan(paths, exceptions):
    errors, hashes, used = [], {}, set()
    today = date.today()
    path_set = set(paths)
    todo = deque(sorted(p for p in paths if p in ENTRIES or p.startswith(SCOPES)))
    for path in paths:
        if SECRET_NAME.search(path):
            errors.append(f'{path!r}: secret-like filename; contents not printed')
        if path.startswith('.github/') and PurePosixPath(path).suffix in {'.yml', '.yaml'}:
            for action in ACTION.findall((ROOT / path).read_text()):
                if not action.startswith('./') and not PIN.fullmatch(action):
                    errors.append(f'{path!r}: GitHub action/reusable workflow must use a full lowercase commit SHA')
    if not ENTRIES.issubset(path_set) or any(not any(p.startswith(s) for p in paths) for s in SCOPES):
        errors.append('Protected release scope is missing or untracked')
    while todo:
        path = todo.popleft()
        if path in hashes:
            continue
        file = ROOT / path
        if file.is_symlink() or not file.is_file():
            errors.append(f'{path!r}: release file missing or symlinked')
            continue
        raw = file.read_bytes()
        sha = digest(raw)
        hashes[path] = sha
        if SECRET_BYTES.search(raw):
            errors.append(f'{path!r}: potential credential signature; contents not printed')
        try:
            for ref in references(path, raw):
                if path == PYODIDE_ASM and sha == PYODIDE_ASM_SHA and ref in NODE_COMPAT:
                    continue
                url = urlsplit(ref.strip())
                if url.scheme or url.netloc or ref.strip().startswith('//'):
                    key = (path, ref)
                    policy = exceptions.get(key)
                    if policy and policy.get('sha256') == sha and today < date.fromisoformat(policy['expires_on']):
                        used.add(key)
                    else:
                        # Do not reveal URL payloads, credentials or query strings in CI logs.
                        errors.append(f'{path!r}: unapproved, modified or expired remote executable reference')
                    continue
                target = unquote(url.path)
                if not target or '\\' in target or '\0' in target:
                    errors.append(f'{path!r}: invalid local executable dependency')
                    continue
                target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(posixpath.dirname(path), target))
                if target not in path_set:
                    errors.append(f'{path!r}: executable dependency is not a tracked local file')
                    continue
                todo.append(target)
        except (UnicodeError, ValueError) as error:
            errors.append(f'{path!r}: could not safely inspect executable dependencies ({type(error).__name__})')
    # An exact unused exception must be removed with the change that retires it.
    for path, _ in sorted(set(exceptions) - used):
        errors.append(f'{path!r}: stale or invalid release dependency exception')
    return hashes, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--write-manifest', action='store_true', help='regenerate manifest after review and staging')
    args = parser.parse_args()
    paths = track_paths()
    rows = json.loads(POLICY.read_text())
    exceptions = {(x['path'], x['reference']): x for x in rows}
    if len(rows) != len(exceptions) or any(not x.get('reason') for x in rows):
        raise SystemExit('Invalid duplicate or undocumented release exception')
    hashes, errors = scan(paths, exceptions)
    expected = json.dumps({'schema': 1, 'files': hashes}, sort_keys=True, indent=2) + '\n'
    if not errors:
        if args.write_manifest:
            MANIFEST.write_text(expected)
        elif not MANIFEST.is_file() or MANIFEST.read_text() != expected:
            errors.append('Release SHA-256 manifest is missing or stale. Review changes and regenerate it.')
    for error in dict.fromkeys(errors):
        print(error, file=sys.stderr)
    if errors:
        return 1
    print(f'MusEDLab release integrity passed ({len(hashes)} hashed files)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
