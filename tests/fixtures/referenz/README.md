# Reference fixtures

`signale/` holds the eleven input signals from the reference package. Two of its
thirteen expected view models — `sema-systemtechnik.de` and `sollich.com` — ship
without an input signal and therefore cannot be reproduced; rebuilding their
inputs from the expected output would make the test check itself, so they are
left out.

`erwartet-stufe1/` is what the Python reference generator produced, kept for
provenance. Commit `f2f8f24` is the proof that the TypeScript port reproduced all
eleven of them field for field, with the catalogue of that moment
(`katalog-stufe1.json`, `firma-stufe1.json`).

`erwartet/` is the current expectation. It differs from `erwartet-stufe1/` by the
content decisions taken afterwards — B6 (measures assembled from the findings'
steps), B7 (missing SPF under an enforcing DMARC policy), B9 (e-mail before
website at equal priority), B12 (a single mail server is no longer a finding),
B13 (passed website tests appear as positives), B14 and B18. Those differences
are intended; `tests/viewmodel.test.ts` names each one so a regression is
reported as a broken decision rather than as an opaque diff.
