# Playable Score encrypted review policy

The companion check is **MusEDLab encrypted review integrity**. It does not
replace **MusEDLab release integrity** or expand the Continuator file manifest.
It starts disabled: both the index and checkout must lack
`review/playable-score/`. The existing reviews in `review/` remain unchanged.
The check also rejects any tracked file named `review-fragment.private`
(including common case and backup variants), anywhere in the repository.

## Approving a release

1. Produce the wrapper from a separately verified score source using the
   reviewed AES-256-GCM builder. Keep the fragment file in protected private
   storage outside the repository, CI, shell logs, and PR. Never upload the
   plaintext score, its component assets, or a full link with the key.
2. Outside Git, use the private key for the offline self-test: decrypt and
   compare every byte to the approved score, reject a wrong key and tampered
   bytes, and verify the browser opens the review and removes the fragment.
   Independently record and review the SHA-256 of the encrypted wrapper.
3. In the approved PR only, stage exactly `review/playable-score/index.html`,
   copied from the tested *public ciphertext* output. In
   `scripts/playable-score-release.json`, retain schema 1, change the state
   to `approved`, and set `files` to the single review path mapped to that
   reviewed lowercase SHA-256. Compare the PR digest against the independent
   digest before merging. Don't copy the builder output directory as a whole.
4. Run the companion check and tests; require passing status on the actual
   protected target branch or in the deployment workflow, along with existing
   required checks and trusted review of modifications to the workflow,
   policy, manifest, or wrapper. Declaring a CI workflow alone does not
   enforce it or prevent GitHub Pages from publishing.

The approved wrapper is the fixed v1 shell and loader with three application
script CSP hashes and one canonical base64 envelope. The CI check cannot
authenticate opaque bytes without a key. For example, it rejects plaintext
HTML, encoded UTF-8 plaintext and loader/CSP substitutions even when the
manifest is changed to match, but cannot distinguish a repinned random blob
or maliciously encrypted app from a valid release. Independent review of the
approved digest plus the private offline decryption test is mandatory.
A published encrypted bearer link is not named-account sharing or revocation;
only send the full link privately to the intended recipient.
