"""Companion policy regression tests with generated, non-secret synthetic blobs."""

import base64
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from check_playable_score_release import MANIFEST, RELEASE, TEMPLATE, Rejected, check, sha


SHELL = Path(__file__).with_name(Path(TEMPLATE).name).read_bytes()
SYNTHETIC_BLOB = bytes(range(128, 256))
SYNTHETIC_HASHES = b" ".join(
    b"'sha256-" + base64.b64encode(bytes([i]) * 32) + b"'" for i in range(1, 4)
)


def envelope(data=SYNTHETIC_BLOB):
    return SHELL.replace(b"@@APP_SCRIPT_HASHES@@", SYNTHETIC_HASHES).replace(
        b"@@PAYLOAD@@", base64.b64encode(data)
    )


class ReviewPolicy(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.git("init", "-q")
        self.put(TEMPLATE, SHELL)
        self.approve()

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True)

    def put(self, path, content, stage=True):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(content)
        if stage:
            self.git("add", "-f", "--", path)

    def approve(self, raw=None, digest=None):
        if raw is not None:
            self.put(RELEASE, raw)
        files = {} if raw is None and digest is None else {RELEASE: digest or sha(raw)}
        body = {"schema": 1, "state": "approved" if files else "disabled", "files": files}
        self.put(MANIFEST, json.dumps(body).encode())

    def test_disabled(self):
        self.put("review/existing-review/index.html", b"Unrelated existing review")
        self.assertEqual(check(self.root), "disabled; no review paths present")

    def test_approved(self):
        self.approve(envelope())
        self.assertEqual(check(self.root), "approved encrypted wrapper verified")

    def test_disabled_rejects_untracked_file(self):
        self.put(RELEASE, envelope(), stage=False)
        with self.assertRaisesRegex(Rejected, "exists while disabled"):
            check(self.root)

    def test_missing_manifest_entry_in_git(self):
        self.approve(digest=sha(envelope()))
        with self.assertRaisesRegex(Rejected, "tracked review path inventory"):
            check(self.root)

    def test_missing_file_from_worktree(self):
        self.approve(envelope())
        (self.root / RELEASE).unlink()
        with self.assertRaisesRegex(Rejected, "worktree review path inventory"):
            check(self.root)

    def test_extra_tracked_file(self):
        self.approve(envelope())
        self.put("review/playable-score/wrong.txt", b"extra")
        with self.assertRaisesRegex(Rejected, "tracked review path inventory"):
            check(self.root)

    def test_extra_untracked_file(self):
        self.approve(envelope())
        self.put("review/playable-score/wrong.txt", b"extra", stage=False)
        with self.assertRaisesRegex(Rejected, "worktree review path inventory"):
            check(self.root)

    def test_case_alias(self):
        self.approve(envelope())
        self.put("Review/Playable-Score/index.html", b"alias")
        with self.assertRaisesRegex(Rejected, "tracked review path inventory"):
            check(self.root)

    def test_wrong_hash(self):
        self.approve(envelope(), digest="0" * 64)
        with self.assertRaisesRegex(Rejected, "SHA-256 differs"):
            check(self.root)

    def test_different_staged_version(self):
        self.approve(envelope())
        self.put(RELEASE, b"<html>plaintext</html>", stage=False)
        with self.assertRaisesRegex(Rejected, "differs from staged"):
            check(self.root)

    def test_plaintext_substitute_with_updated_manifest(self):
        self.approve(b"<!doctype html><p>Plaintext review content</p>")
        with self.assertRaisesRegex(Rejected, "approved shell"):
            check(self.root)

    def test_base64_plaintext_substitute_with_updated_manifest(self):
        self.approve(envelope(b"<!doctype html><p>Plaintext review content</p>"))
        with self.assertRaisesRegex(Rejected, "plaintext UTF-8"):
            check(self.root)

    def test_modified_csp_with_updated_manifest(self):
        self.approve(envelope().replace(b"connect-src 'none'", b"connect-src https:"))
        with self.assertRaisesRegex(Rejected, "approved shell"):
            check(self.root)

    def test_modified_loader_with_updated_manifest(self):
        self.approve(envelope().replace(b"allow-scripts allow-downloads", b"allow-scripts allow-same-origin"))
        with self.assertRaisesRegex(Rejected, "approved shell"):
            check(self.root)

    def test_extra_markup_with_updated_manifest(self):
        self.approve(envelope().replace(
            b"</template><script>", b"</template><p>secret plaintext</p><script>"
        ))
        with self.assertRaisesRegex(Rejected, "approved shell"):
            check(self.root)

    def test_extra_script_hash_with_updated_manifest(self):
        self.approve(envelope().replace(SYNTHETIC_HASHES, SYNTHETIC_HASHES + b" " + SYNTHETIC_HASHES))
        with self.assertRaisesRegex(Rejected, "approved CSP"):
            check(self.root)

    def test_damaged_envelope_with_updated_manifest(self):
        self.approve(envelope().replace(base64.b64encode(SYNTHETIC_BLOB), b"!malformed-base64!"))
        with self.assertRaisesRegex(Rejected, "noncanonical base64"):
            check(self.root)

    def test_too_short_envelope_with_updated_manifest(self):
        self.approve(envelope(b"0"))
        with self.assertRaisesRegex(Rejected, "too short"):
            check(self.root)

    def test_private_filename_outside_review(self):
        self.put("unrelated/Review-Fragment.PRIVATE.backup", b"NOT A KEY")
        with self.assertRaisesRegex(Rejected, "private review fragment filename"):
            check(self.root)

    def test_staged_symlink(self):
        self.approve(digest=sha(envelope()))
        p = self.root / RELEASE
        p.parent.mkdir(parents=True)
        p.symlink_to("../../scripts/playable-score-release.json")
        self.git("add", "--", RELEASE)
        with self.assertRaisesRegex(Rejected, "regular, tracked"):
            check(self.root)

    def test_template_repin_attempt(self):
        self.put(TEMPLATE, SHELL.replace(b"connect-src 'none'", b"connect-src https:"))
        with self.assertRaisesRegex(Rejected, "pinned version"):
            check(self.root)

    def test_manifest_duplicate_key(self):
        self.put(MANIFEST, b'{"schema":1,"state":"disabled","files":{},"files":{}}')
        with self.assertRaisesRegex(Rejected, "duplicate key"):
            check(self.root)
