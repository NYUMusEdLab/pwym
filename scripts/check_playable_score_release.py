#!/usr/bin/env python3
"""Check the explicitly approved Playable Score envelope without accessing its key."""

import base64
import binascii
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = "review/playable-score"
RELEASE = f"{NAMESPACE}/index.html"
MANIFEST = "scripts/playable-score-release.json"
TEMPLATE = "scripts/playable-score-wrapper-v1.html.template"
TEMPLATE_SHA = "f6fc8e157a53c70769dae27201477660b80c5f3a776b17d2205f6fa8addab9b5"
MAX_WRAPPER = 24 * 1024 * 1024
HASH = re.compile(r"[0-9a-f]{64}")
APP_HASHES = re.compile(rb"'sha256-([A-Za-z0-9+/]{43}=)' 'sha256-([A-Za-z0-9+/]{43}=)' 'sha256-([A-Za-z0-9+/]{43}=)'")
PRIVATE_NAME = re.compile(r"review[-_. ]*fragment(?:[-_. ].*)?\.private(?:[-_. ].*)?$")
PRIVATE_LITERAL = re.compile(rb"#k=[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])")


class Rejected(ValueError):
    """A release policy violation. Messages must not contain file contents."""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalized(name):
    return unicodedata.normalize("NFKC", name).casefold().rstrip(". ")


def git(root, *args):
    return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)


def read_index(root):
    entries = {}
    for row in git(root, "ls-files", "--stage", "-z").split(b"\0"):
        if not row:
            continue
        info, name = row.split(b"\t", 1)
        mode, _oid, stage = info.split()
        name = name.decode("utf-8", "surrogateescape")
        basename = normalized(PurePosixPath(name).name)
        if PRIVATE_NAME.fullmatch(basename):
            raise Rejected("private review fragment filename present in the Git index")
        if stage != b"0":
            if matches_namespace(name) or name in (MANIFEST, TEMPLATE):
                raise Rejected("unmerged review or policy file in the Git index")
            continue
        entries[name] = mode
    return entries


def read_regular(root, path, limit):
    file = root / path
    try:
        info = file.lstat()
    except FileNotFoundError:
        raise Rejected(f"missing required file: {path}") from None
    if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
        raise Rejected(f"not a regular file within the size limit: {path}")
    return file.read_bytes()


def read_approved_version(root, index, path, limit):
    if index.get(path) != b"100644":
        raise Rejected(f"expected regular, tracked, non-executable file: {path}")
    raw = read_regular(root, path, limit)
    if sha(raw) != sha(git(root, "show", f":{path}")):
        raise Rejected(f"working tree differs from staged bytes: {path}")
    return raw


def matches_namespace(path):
    parts = path.split("/")
    return len(parts) >= 2 and tuple(map(normalized, parts[:2])) == ("review", "playable-score")


def check_worktree_inventory(root, expected):
    entries = [item for item in root.iterdir() if normalized(item.name) == "review"]
    if not entries and not expected:
        return
    if len(entries) != 1 or entries[0].name != "review" or entries[0].is_symlink() or not entries[0].is_dir():
        raise Rejected("review parent must be the exact regular directory")
    matches = [item for item in entries[0].iterdir() if normalized(item.name) == "playable-score"]
    if not expected:
        if matches:
            raise Rejected("review namespace exists while disabled")
        return
    if len(matches) != 1 or matches[0].name != "playable-score" or matches[0].is_symlink() or not matches[0].is_dir():
        raise Rejected("approved namespace must be the exact regular directory")
    children = {item.name for item in matches[0].iterdir()}
    if children != {"index.html"}:
        raise Rejected("worktree review path inventory differs from approval")


def strict_object(pairs):
    result = {}
    for key, val in pairs:
        if key in result:
            raise Rejected("duplicate key in review manifest")
        result[key] = val
    return result


def parse_manifest(raw):
    try:
        obj = json.loads(raw, object_pairs_hook=strict_object)
    except (json.JSONDecodeError, UnicodeDecodeError, RecursionError):
        raise Rejected("malformed review manifest") from None
    if (not isinstance(obj, dict) or set(obj) != {"schema", "state", "files"} or
            type(obj["schema"]) is not int or obj["schema"] != 1 or not isinstance(obj["files"], dict)):
        raise Rejected("review manifest must use the exact v1 schema")
    files = obj["files"]
    if obj["state"] == "disabled" and not files:
        return files
    if (obj["state"] == "approved" and set(files) == {RELEASE} and
            isinstance(files[RELEASE], str) and HASH.fullmatch(files[RELEASE])):
        return files
    raise Rejected("approval must be disabled or specify exactly one path and its lowercase SHA-256")


def canonical_base64(raw):
    try:
        decoded = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise Rejected("noncanonical base64 in the review envelope") from None
    if base64.b64encode(decoded) != raw:
        raise Rejected("noncanonical base64 in the review envelope")
    return decoded


def check_wrapper(raw, template):
    if PRIVATE_LITERAL.search(raw):
        raise Rejected("a literal review fragment is embedded in the wrapper")
    prefix, tail = template.split(b"@@APP_SCRIPT_HASHES@@")
    middle, suffix = tail.split(b"@@PAYLOAD@@")
    if not raw.startswith(prefix) or not raw.endswith(suffix):
        raise Rejected("wrapper does not have the approved shell, privacy policy, and loader")
    variable = raw[len(prefix):-len(suffix)]
    hashes, present, payload = variable.partition(middle)
    match = APP_HASHES.fullmatch(hashes)
    if not present or match is None:
        raise Rejected("wrapper does not have the exact approved CSP or a single envelope")
    if not all(len(canonical_base64(h)) == 32 for h in match.groups()):
        raise Rejected("invalid application script digest")
    decoded = canonical_base64(payload)
    if len(decoded) <= 12 + 16:
        raise Rejected("envelope is too short for a nonce, ciphertext, and authentication tag")
    try:
        decoded.decode("utf-8")
    except UnicodeDecodeError:
        return
    raise Rejected("envelope body decodes as plaintext UTF-8")


def check(root=ROOT):
    index = read_index(root)
    template = read_approved_version(root, index, TEMPLATE, 8192)
    if sha(template) != TEMPLATE_SHA:
        raise Rejected("canonical wrapper template is not the pinned version")
    expected = parse_manifest(read_approved_version(root, index, MANIFEST, 4096))
    indexed = {path for path in index if matches_namespace(path)}
    if indexed != set(expected):
        raise Rejected("tracked review path inventory differs from approval")
    check_worktree_inventory(root, expected)
    for path, approved in expected.items():
        raw = read_approved_version(root, index, path, MAX_WRAPPER)
        if sha(raw) != approved:
            raise Rejected("review wrapper SHA-256 differs from approval")
        check_wrapper(raw, template)
    return "approved encrypted wrapper verified" if expected else "disabled; no review paths present"


if __name__ == "__main__":
    try:
        print("Playable Score review:", check())
    except (Rejected, OSError, subprocess.CalledProcessError) as exc:
        # OSError/subprocess may include filenames; redact unexpected details.
        message = str(exc) if isinstance(exc, Rejected) else "unable to read the Git index or files"
        print(f"Playable Score review rejected: {message}", file=sys.stderr)
        sys.exit(1)
