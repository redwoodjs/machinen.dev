# 0001 — Default Node is exposed via `/etc/environment` + fnm-shadow, not exec-agent wrapping

A fnm-managed Node must resolve on the **Boot cmd**'s PATH and across every **Exec-agent** invocation, so we ship `/etc/profile.d/fnm.sh` (which shadows `fnm` to re-link `/usr/local/node-current` on `default`/`use`/`install`) plus `/etc/environment` putting `/usr/local/node-current/bin` on the system PATH; `/init` reads `/etc/environment` so the **Boot cmd** inherits it.

The alternative — making the **Exec-agent** prepend `eval "$(fnm env)"` to every command — was rejected for three reasons: it doesn't cover the **Boot cmd** path (which never reaches the exec-agent), it adds bespoke machinen logic where a Unix convention already exists, and it doesn't propagate `npm install -g <pkg>` onto PATH the way symlinking the version's whole bin dir does for free.

A `machinen-use-node <v>` helper was also considered and rejected: introducing a new vocabulary alongside fnm keeps the user's mental model muddier than letting `fnm default` appear to do the right thing on its own (the shadow is invisible).

For the shadow to fire on one-shot exec, the **Exec-agent** invokes commands via `bash -l -c` (login shell) rather than `sh -c`. `machinen attach`'s default shell is `bash -l -i` for the same reason on the interactive side. Tracks #308.
