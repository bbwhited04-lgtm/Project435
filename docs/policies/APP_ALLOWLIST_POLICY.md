\# App Allowlist Policy



Only allowlisted applications may be installed or executed by Pluto.



Install sources (preferred):

1\) OS package manager (e.g., winget / Microsoft Store)

2\) Vendor official domain(s) on allowlist

3\) Internal repository controlled by owner



Verification:

\- Verify publisher signature (Authenticode) before execution

\- Prefer hash verification when possible

\- Log every install/run action



Human approval required for:

\- Admin/UAC elevation

\- System setting changes

\- Driver/service installs

\- Anything outside sandbox folders



