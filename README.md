# Fieldwork — public support workflow demo

Live demo: https://ManimaranRepos.github.io/fieldwork-demo/

A portfolio MVP for investigating real public GitHub issues, reviewing related evidence, and approving response drafts locally.

## Scope
- Public HTTPX issue snapshot, with optional live GitHub reads and clearly labeled fallback.
- Browser-local keyword retrieval and template-based drafts; no LLM is connected in this public edition.
- Review state stays in each visitor’s browser. No GitHub writes, secrets, or shared database.
- The full private Python edition supports Groq; it is not deployed here.

## Run
`npm ci`, then `npm run dev`. Build with `npm run build -- --base=/fieldwork-demo/`.
The `docs` folder is the generated GitHub Pages deployment.

## License and attribution
Original application code is MIT licensed. Public issue text, comments, documentation, and release notes remain attributable to their original authors and retain their original terms. Source links are preserved in the demo; their inclusion does not imply endorsement.
