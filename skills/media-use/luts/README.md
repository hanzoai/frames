# LUT library (authoring)

`index.json` is the agent-consumed catalog of color-grade looks. Each entry
builds on demand — no `.cube` bodies are committed to the repo.

Each look has:

- `id`, `description`, `tags`, `intensity` — matching + application metadata.
- `params` — a deterministic `buildCube` spec. The same look builds the same
  bytes on every machine, offline, with no host to keep alive.

## Authoring a new look

1. Find the params: `resolve -t lut --params '{...}'` writes a `.cube` you can
   inspect and iterate on.
2. Add an entry to `index.json` with those `params`, an `id`, a `description`,
   and the `tags` an intent is likely to use.

A look is matched lexically against the intent, so write the description and
tags in the words a person would actually say.
