#!/usr/bin/env bash
set -euo pipefail
: "${RUNTIME_STATE_KEY:?RUNTIME_STATE_KEY is required}"
mkdir -p "$HOME/runtime-state-restored"
for f in .runtime-state/*.gpg; do
  [ -e "$f" ] || continue
  out="$HOME/runtime-state-restored/$(basename "${f%.gpg}")"
  gpg --quiet --batch --yes --pinentry-mode loopback \
      --passphrase "$RUNTIME_STATE_KEY" \
      --output "$out" --decrypt "$f"
done
echo "Decrypted archives are in $HOME/runtime-state-restored"
