# Release intents

Use `pnpm changeset` to record a consumer-facing change and choose affected packages.
`pnpm release:status` previews planned versions. `pnpm release:version` applies the
intents and propagates workspace dependency changes; commit the result after review.
All libraries currently remain private. Claim the scope, complete the release review,
and explicitly authorize publication before changing that setting or publishing.
