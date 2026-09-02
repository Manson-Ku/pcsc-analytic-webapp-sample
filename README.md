# PCSC Analytic Web App Sample

Reference implementation / business-technology translation sample for the PCSC analytics Web App login and authorization flow.

> This repository is **not** a production IAM implementation. It defines a concrete, reviewable business scenario, state machine, adapter contracts, and mock interaction flow so PIC / implementation teams can replace the mock identity sources with existing enterprise systems.

## Scope

This sample separates four concerns that must not be conflated:

1. **Store Context** — which store context the current device/session represents.
2. **Human Identity** — who the current human user is.
3. **Authorization** — which stores that person is allowed to access.
4. **Selected Store** — which authorized store the UI is currently showing.

Key business rules represented here:

- General store reports can be shown from store context without requiring every store employee to sign in personally.
- Sensitive reports require a separate human identity step.
- Store manager / area advisor sensitive access is based on their authorized store list, not the physical store they are currently standing in.
- When a human session expires on a shared store device, the app clears the human/sensitive session and returns to the store general report; it does not log out the underlying store context.
- If a user enters sensitive mode while physically at an authorized store, that store may be used as the initial UI selection only. It never narrows the user's actual authorization.

## Repository layout

```text
docs/
  01-login-state-machine-v0.1.md
  02-scenario-sequence-v0.1.md
  03-adapter-contract-v0.1.md
  04-assumption-register-v0.1.md
sample/
  index.html
  app.js
  styles.css
```

## Run the sample

No build step is required.

Open `sample/index.html` in a browser, or serve the repository with any static HTTP server.

Example:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/sample/
```

## Integration boundary

The sample uses mock providers only. A future implementation team should replace the following interfaces with PCSC / PIC implementations without changing the business state machine:

```text
StoreIdentityProvider
HumanIdentityProvider
AuthorizationProvider
```

See `docs/03-adapter-contract-v0.1.md`.

## Status

- Reference Spec: v0.1
- Production SSO / IAM: out of scope
- Device trust / MDM integration: out of scope
- Session timeout value: configurable / TBD
