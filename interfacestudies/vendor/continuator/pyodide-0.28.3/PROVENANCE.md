# Frozen Continuator browser runtime

Scope: PWYM standalone Continuator and the AI Music Lab Continuator worker.
Both use these same files from this site, without a third-party runtime dependency.
The Continuator source and its notices remain in each app's own directory.

## Runtime closure

- Pyodide v0.28.3, official GitHub release core archive. The publisher's release
  API lists SHA-256 `46fd28bfacd5b78333d73f171412cc992a2cab2332b067e4d2181fd255cca730`.
  The archive was checked against that digest. All five included core files
  also matched the original v0.28.3 CDN bytes byte-for-byte.
- The official lock identifies NumPy 2.2.5 and no further package prerequisites.
  The NumPy wheel from Pyodide's official CDN matched the SHA-256 in that lock.
- The official v0.28.3 core distribution and CDN carry an unchanged lockfile
  whose info version is `0.28.0.dev0`. The release loader itself identifies
  as `0.28.3`. The lock is preserved as distributed, not edited.
- The workers set both `indexURL` and `packageBaseUrl` to this directory and
  use the package lock's NumPy integrity check. There is no external fallback.
- Source and license links are attribution only. They are not loaded by the app.
  See `licenses/` for retained license texts: Pyodide, CPython, NumPy and Emscripten.

## Corresponding sources and release evidence

- [Pyodide official release](https://github.com/pyodide/pyodide/releases/tag/0.28.3) ·
  [release asset digest via GitHub API](https://api.github.com/repos/pyodide/pyodide/releases/tags/0.28.3) ·
  [core archive](https://github.com/pyodide/pyodide/releases/download/0.28.3/pyodide-core-0.28.3.tar.bz2)
- [Pyodide source](https://github.com/pyodide/pyodide/tree/c28b6fbc05a6552efb876f2f87a4e05cccaf6573) ·
  [original CDN release](https://cdn.jsdelivr.net/pyodide/v0.28.3/full/)
- [CPython 3.13.2](https://github.com/python/cpython/tree/v3.13.2) ·
  [NumPy 2.2.5](https://github.com/numpy/numpy/tree/v2.2.5) ·
  [Emscripten 4.0.9](https://github.com/emscripten-core/emscripten/tree/4.0.9)

Run `sha256sum -c SHA256SUMS` from this directory to validate each runtime
and license file. Run `node smoke-offline.cjs` from this directory to check
browser worker path policy and exercise both bridges on the actual frozen
Python and NumPy runtime with external networking blocked.
