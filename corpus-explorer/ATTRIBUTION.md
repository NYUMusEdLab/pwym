# Attribution and data licence

This is a non-commercial MusEDLab learning/research interface. No endorsement by source publishers or corpus creators is implied.

## Schubert: Winterreise (24 songs)
Source: DCMLab, *Franz Schubert – Winterreise (A corpus of annotated scores)*, https://github.com/DCMLab/schubert_winterreise . Licence: Creative Commons Attribution-NonCommercial-ShareAlike4.0 International (CC BY-NC-SA4.0), https://creativecommons.org/licenses/by-nc-sa/4.0/ .

Please cite: Hentschel, J., Rammos, Y., Neuwirth, M., & Rohrmeier, M. (2025). A corpus and a modular infrastructure for the empirical study of (an)notated music. Scientific Data12,685. https://doi.org/10.1038/s41597-025-04976-z . Corpus annotations credit Alexander Faschon and review Johannes Hentschel in source metadata; individual source credits remain upstream.

Music: Franz Schubert; poems: Wilhelm Müller. Adaptation by MusEDLab,2026: vocal staff1/voice1 extracted from notes/chords TSV; ties merged; lyrics retained as encoded; piano accompaniment excluded; score-order timing and encoded playback tempo retained; repeats not unfolded.

## Mozart: symphonies39–41 (K543, K550, K551),12 movements
Source and rights holder: Internationale Stiftung Mozarteum Salzburg, Digital Interactive Mozart Edition (DIME), Neue Mozart-Ausgabe representations. Each downloaded MEI source declares CC BY-NC-SA4.0 International. Source catalogue: https://dme.mozarteum.at/movi/en . Direct movement links are retained in every record.

Adaptation by MusEDLab,2026: ViolinI first-layer melodic reduction, highest chord note selected; variant lemma or version2 preferred where alternatives occur; rests preserved as timing gaps; ties merged; grace notes omitted; repeats not unfolded; one missing K551/I timestamp inferred from preceding duration. Source/gestural accidentals retained. These adaptations are not a critical edition or a human-validated transcription. Encoded MIDI tempos are playback settings, not verified historical-performance evidence.

## Reuse
Adapted corpus-index.json is distributed under CC BY-NC-SA4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/ . The full legal terms govern. Retain source attribution, licence links and change notices, indicate further changes, do not use the licensed material commercially, and apply the same licence to further adapted material. Source corpus and edition rights are not replaced by a software licence.

The original interface implementation is separate from the licensed data; no rights are asserted over original compositions. No Shanghai or previous music21 Bach data, source archives, third-party recordings, private paths or user research records are bundled.

### Mozart edition credits from original MEI headers
- K543-1: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/543/1/nma
- K543-2: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/543/2/nma
- K543-3: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/543/3/nma
- K543-4: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/543/4/nma
- K550-1: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/550/1/nma
- K550-2: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/550/2/nma
- K550-3: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/550/3/nma
- K550-4: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/550/4/nma
- K551-1: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/551/1/nma
- K551-2: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/551/2/nma
- K551-3: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/551/3/nma
- K551-4: See source MEI file description for edition contributors; https://dme.mozarteum.at/movi/file/551/4/nma

## Bach: licensed389-setting edition (added2026-11-13)

Gertim Alberda & Johannes Hentschel (2024), *A digital edition of the389 Chorale Settings (Choralgesänge) by J.S. Bach*, https://doi.org/10.5281/zenodo.11358762 . Authoritative MuseScore source: https://github.com/johentsch/389_chorale_settings . Dataset author Gertim Alberda explicitly agreed to CC BY-NC-SA4.0; licence https://creativecommons.org/licenses/by-nc-sa/4.0/ .

Chorale Corpus derived TSV releasev1.1: https://github.com/Chorale-Corpus/Bach_JS/releases/tag/v1.1 . Cite Gerhardt, K., Hentschel, J., Phan, V. D., Kirsch, M., Kirsch, K., & Gotham, M. R. H. (2026), Beyond Ba(t)ch: A Multimodal Meta-Corpus of Digital Chorale Transcriptions and Related Data. TISMIR9(1),440–455. https://doi.org/10.5334/tismir.226 .

MusEDLab adaptation: soprano staff1/voice1 extracted from ms3 notes/chords TSV; lyrics retained; ties merged; grace events omitted. Written sequence includes alternative endings but repeats are not unfolded. Encoded playback tempo may reflect Alberda's editorial humanization rather than historical metronome evidence. Complete soprano pitch sequences in B001,B014,B199 and B389 were compared with authoritative MSCX and matched; this spot check is not full scholarly validation. Structural timing/array checks cover all389.

The upstream project warns that its converted MusicXML and MEI are unsuitable for scholarly work; neither conversion was used here. Commercial recordings and their audio excerpts are NOT included. This licence covers this distinct corpus, NOT the previously used409 music21 encoding files. Adapted Bach data remains CC BY-NC-SA4.0, with the same attribution/non-commercial/share-alike and change-notice conditions as the other data.
