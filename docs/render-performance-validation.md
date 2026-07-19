# Render-performance validation

This repository's deterministic editor fixture is the following Markdown body.
Run it as a note with the renderer set first to Smiles Drawer, then RDKit.  Use
the same content for the 0, 12, and 24-structure cases (delete all but the
requested number of inline expressions).

```markdown
`$smiles=CCO` `$smiles=CC(=O)O` `$smiles=c1ccccc1` `$smiles=CCN`
`$smiles=CCCl` `$smiles=CCBr` `$smiles=C=C=C` `$smiles=CC#C`
`$smiles=[H][H]` `$smiles=CCC[C-]` `$smiles=CCO>>CC=O`
`$smiles=CC(=O)Oc1ccccc1C(=O)O`

```smiles
CCO
CC(=O)O
c1ccccc1
CCN
CCCl
CCBr
C=C=C
CC#C
[H][H]
CCC[C-]
CCO>>CC=O
CC(=O)Oc1ccccc1C(=O)O
```
```

For each renderer, inline and fenced-block case, record a cold run and a
post-warm-up run on desktop, iPad/iOS, and Android when available. Use the
browser performance panel to capture input latency while typing ordinary text
outside an expression, including an iPad soft-keyboard viewport resize.

## Expected behavior after #4

`CachedChemCore` is the single render boundary for editor widgets, Markdown
blocks, and copy/export. Its 64-entry LRU-style cache key includes renderer,
source, selected theme, and current renderer settings. Each consumer gets a
deep SVG/HTML clone, so cached output is never moved between Markdown children.

The cache records draw calls, hits, misses, avoided duplicate renders, and
cumulative uncached render time through `CachedChemCore.cache.snapshot()`.
For a stable note, the first visible pass should contain one miss per distinct
structure/theme/options combination; subsequent viewport changes and ordinary
typing should increase cache hits without invoking the underlying RDKit or
Smiles Drawer renderer. Change a SMILES expression, theme, or settings to
verify a deliberate cache miss.

Do not interpret the cache unit test as iPad verification. Attach a real-device
trace and the before/after measurements to Issue #4 before closing the upstream
typing-latency report.
