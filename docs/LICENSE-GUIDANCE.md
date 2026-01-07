# License Guidance for Cap Self-Hosting Projects

## Common Misconception

**Incorrect:** "Because Cap is AGPL-3.0, my Docker Compose files must also be AGPL-3.0."

**Correct:** Your wrapper code (Docker Compose, scripts, patches) can use any license you choose (MIT, Apache-2.0, etc.). Only the final Docker image containing Cap is subject to AGPL-3.0.

## How Copyleft Works

AGPL-3.0 is a "copyleft" license. This means:

1. **Code that becomes part of the AGPL work** → must be AGPL-compatible
2. **Code that merely uses or orchestrates the AGPL work** → can be any license

### What IS affected by AGPL (must provide source)

- The Cap application source code
- Any modifications you make directly to Cap's source files
- The compiled application inside the Docker image

### What is NOT affected by AGPL (your choice of license)

| Component | Why it's independent |
|-----------|---------------------|
| Docker Compose files | Configuration files that reference images |
| Dockerfiles | Build instructions, not part of the application |
| Shell scripts | Separate tools that invoke Docker commands |
| Patch files | Standalone files (the *result* of patching is AGPL, not the patch file itself) |
| Environment templates | Configuration templates |
| Documentation | Not software |

## Legal Basis

### Aggregation vs. Derivative Work

The GNU licenses distinguish between:

- **Derivative Work**: Code that is combined with or modifies GPL/AGPL code at the source level
- **Aggregation**: Independent works distributed together or one invoking another

From the [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation):

> "Mere aggregation of two programs means putting them side by side... This is permitted under the GPL."

Docker Compose files are aggregation - they orchestrate containers but don't become part of the containerized application.

### The "Linking" Question

AGPL's copyleft applies when code is "linked" or "combined" with AGPL code. Docker containers are process-isolated:

- Your Compose file runs `docker run cap-image`
- This is equivalent to running any external program
- No linking occurs; process boundaries are maintained

## Correct License Structure

```
your-repository/           (MIT License - your choice)
├── docker-compose.yml     (MIT - orchestration config)
├── Dockerfile             (MIT - build instructions)
├── scripts/               (MIT - your tools)
├── patches/               (MIT - your contributions)
└── .env.example           (MIT - template)

docker-image (built)       (AGPL-3.0 - contains Cap)
└── /app/                  (AGPL-3.0 - Cap application)
```

## Your AGPL Obligations

When you **deploy** the Docker image as a network service, AGPL requires:

1. **Source availability**: Users must be able to obtain the source code
2. **Modification disclosure**: If you modified Cap, provide those modifications

### How to Comply

Simply ensure these are accessible to your users:

- Cap source: <https://github.com/CapSoftware/Cap>
- Your patches: Your public repository or provide on request

You do NOT need to:
- License your Compose files as AGPL
- License your scripts as AGPL
- Relicense anything that doesn't contain Cap source code

## Example NOTICE.md

```markdown
# Third-Party Software Notices

This repository is licensed under MIT.

The Docker images built from this repository include Cap (AGPL-3.0).
The resulting Docker images are subject to AGPL-3.0 terms.

Source code availability:
- Cap: https://github.com/CapSoftware/Cap
- This repository: https://github.com/your-org/your-repo
```

## Summary

| Question | Answer |
|----------|--------|
| Can my Compose files be MIT? | Yes |
| Can my Dockerfile be MIT? | Yes |
| Can my scripts be MIT? | Yes |
| Is the Docker image AGPL? | Yes (contains Cap) |
| Must I provide Cap source? | Yes (link to GitHub is sufficient) |
| Must I provide my patches? | Yes (if you modified Cap) |

## References

- [GNU GPL FAQ - Mere Aggregation](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation)
- [GNU GPL FAQ - GPLInProprietarySystem](https://www.gnu.org/licenses/gpl-faq.html#GPLInProprietarySystem)
- [AGPL-3.0 License Text](https://www.gnu.org/licenses/agpl-3.0.html)
- [OSI License Compatibility](https://opensource.org/licenses)

---

*This document is provided for informational purposes only and does not constitute legal advice.*
