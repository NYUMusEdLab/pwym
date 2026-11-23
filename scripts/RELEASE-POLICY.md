# Required public release check

`gh-pages` is the served branch. This workflow alone does **not** stop a push
from publishing. The workflow must be paired with repository-side enforcement.

## Activation after the workflow is merged

1. Run the workflow and confirm its job **MusEDLab release integrity** succeeds.
2. In the repository ruleset targeting exactly `refs/heads/gh-pages`, require
   pull requests, require status checks, and select **MusEDLab release integrity**
   with **GitHub Actions** as its expected source. Require the branch to be up to
   date before merging (or use a merge queue that runs this workflow).
3. Set enforcement to **Active** without bypass users, roles, apps, or deploy
   keys. Disallow force pushes and branch deletion. Ordinary releases need zero
   human approvals and can be self-merged by their author after the check.
   Protect changes to `/.github/workflows/`, `/scripts/check_release.py`,
   `/scripts/release-exceptions.json`, and future policy enforcement files separately
   with a trusted required workflow or ruleset-backed path restriction and
   independently reviewed policy changes. The SHA manifest is a normal release
   file and can update in a self-service release. Do not invent CODEOWNERS
   identities or turn on a branch-wide human review requirement. If relying on
   CODEOWNERS, verify that only covered policy changes are gated and that the
   CODEOWNERS file itself is protected. GitHub Apps or deploy keys with write
   access must not bypass the rule.
4. Read back the actual active settings. Verify that a scoped PR with a stale
   manifest fails, a corrected PR passes, and branch rules reject a direct
   update. Use non-production test conditions or a ruleset test/dry run to avoid
   publishing a deliberately failing fixture. Until verified, report code/check
   setup as staged, not mandatory in production.

If repository capabilities cannot enforce the rules above, or direct pushes
are preferred for self-service, migrate the Pages source to **GitHub Actions**.
Use a protected workflow or trusted external reusable workflow: verify the
exact release commit, package only after verification, and deploy that artifact
in a dependent job restricted to the GitHub Pages environment. Disable old
branch publishing and prevent workflows other than the approved release path
from deploying Pages. A direct push can then queue a release without granting a
bypass: only a passing check may deploy.

## Scope and checks

The integrity manifest covers all tracked files under `corpus-explorer/`,
`experimental-tools/`, `rengongfu/`, `interfacestudies/continuator/`, and
`interfacestudies/ai-music-lab/`, plus the Interface Studies directory page, the complete shared frozen
Continuator runtime under `interfacestudies/vendor/continuator/`, and
tracked local executable/style dependencies reachable from these files. Nested
worker scripts, local engine archives, model weights and vendored JS are covered.
Ordinary links and MusicXML fetched as data are not executable dependencies.
Unrelated historical app pages are not scanned as modern JS releases.

The checker catches recognizable external script, worker, import, stylesheet
and other executable references. It also rejects recognized credentials or
private key signatures within checked artifacts, secret-like tracked filenames
across the repository, and nonlocal Actions references without full commit
pinning. It does not print matched contents. It is not a full JavaScript parser
or a general secret scanner and cannot determine the behavior of arbitrary
dynamically generated code. Review changes to dependency-loading code and
manifests, especially binary archives, new loading patterns and versions.
Do not rely on the expected check name as a substitute for protecting workflow
and policy changes.

The only remote executable exception is in `release-exceptions.json`: the
consent-gated GA script at its exact reviewed source hash. It has a specific
reference and UTC date on which it stops working. Review before renewing and
remove it if the code no longer uses it. A new script or change to an exempt
file fails closed unless it passes without the exception or a reviewed policy
update revises the exact hash.

Both Continuator workers now load the same-origin frozen Pyodide and NumPy
runtime closure. Its original publisher release digest, NumPy lock digest,
notices and local reproducibility procedure are documented alongside it in
`interfacestudies/vendor/continuator/pyodide-0.28.3/PROVENANCE.md`. The release
manifest covers every file in the closure. Preserved upstream source metadata
and license text are not remote executable exceptions. The stock Pyodide build
contains Node-only compatibility imports; the checker recognizes only those
exact imports in the unchanged publisher file, not a blanket vendor bypass.

## Updating a release

Stage intended additions/removals before regenerating. No package install:

```sh
python3 scripts/check_release.py --write-manifest
git add scripts/release-sha256.json
python3 scripts/check_release.py
```

Review the manifest and release diff, run the relevant browser smoke checks,
then request review. Manifest generation does not allow an unapproved executable
or suspicious file. Do not add secret-like files to the repository.
