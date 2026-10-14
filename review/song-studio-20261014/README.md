# Song Studio — public review prototype

Open the Fresh Annotator example for **The Proof is in the Passage**, by C. Pettigrew and A. Liles, from *Fresh Education: The Next Generation*. Original audio, lyrics and song metadata load from their existing public Fresh Annotator host. Eight previously approved recovered default drawings are bundled. No original audio or lyric file was re-uploaded for this release. Recovered drawing authorship and unchanged historical state are unverified.

The import preserves 272 timed units, including 19 whole phrases with no internal word alignment. Twenty keywords include 13 illustrated occurrences. Seven original sections remain; an Audio tail section retains the recording beyond the old catalog duration. Timings are unreviewed. Recovered art uses original Grow together animation.

Choose audio, edit lyrics and timing, star keywords, draw, add notes, preview animation, and save editable project copies with audio. Suggest a drawing offers 22 editable local templates matched to common English words; choose a picture for other words. Sketch empty keywords keeps existing artwork. Applying a suggestion keeps the previous drawing in the project for restoration.

This is a browser-local static prototype. There is no account, cloud storage, upload backend, microphone recording, automatic transcription, forced alignment, or generative image service. No paid service is required. The original Annotator loader, timing engine and drawing renderer run in the preview and independent import harness.

The real example needs an internet connection on first load. Saved projects and audio stay in this browser; download a copy for backup and to move between devices. Exported Annotator kits are for the local integration harness; they do not publish to live Fresh Annotator. Only the synthetic melody fixture ships with the app as audio.

Public, unlisted review URL: https://www.musedlab.org/review/song-studio-20261014/ . No sign-in required. The page requests no search indexing; this is not an access restriction.


The loaded-song overview shows waveform, following lyrics, and live drawings together. Drawings persist across blank keywords and gaps; a music-note illustration appears before the first artwork. The word editor scrolls within short desktop windows.

A separate local Python timing-service pilot can align supplied English lyrics. Import its JSON through Import word-timed lyrics, then review selected changes. Matching words retain drawings and notes; changed lyrics require explicit archival. This public static site does not upload audio to that service.
