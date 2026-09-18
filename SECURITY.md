# Security

- Tokens live in env or the `Authorization` header — never in git, HTML, or skill files.
- Writes start **PAUSED**. ACTIVE / delete / pause require confirm flags.
- Media upload failure must not fall back to another asset.
- Report vulnerabilities privately via the GitHub security advisory on this repository. Do not file public issues for token leaks.
