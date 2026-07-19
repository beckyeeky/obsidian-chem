# RDKit reaction theming

RDKit.js currently exposes reaction SVG generation through
`JSReaction.get_svg_with_highlights()`, but that wrapper does not apply the
molecule drawing palette or `clearBackground` options. This remains true for
the plugin's pinned RDKit.js release.

To make reactions consistent with molecule drawings, Chem post-processes only
the generated SVG:

- removes the generated background rectangle when `clearBackground` is enabled;
- remaps RDKit's standard atom and bond colours to the selected theme palette;
- uses the theme's symbol colour for unclassified reaction-arrow paths; and
- uses that same symbol colour for RDKit note annotations where present.

The SVG geometry is left untouched, so arrowheads remain the paths produced by
RDKit. If a future RDKit.js release applies reaction drawing options directly,
this compatibility layer can be removed after its regression test continues to
pass.
