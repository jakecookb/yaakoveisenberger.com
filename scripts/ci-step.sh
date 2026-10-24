#!/usr/bin/env bash
# Runs a CI step; on failure, posts the last lines of its output as a GitHub annotation (readable without log access).
name="$1"; shift
log=$(mktemp)
if ! ( "$@" ) >"$log" 2>&1; then
  cat "$log"
  msg=$(tail -n 40 "$log" | sed 's/\x1b\[[0-9;]*m//g' | sed ':a;N;$!ba;s/%/%25/g;s/\r//g;s/\n/%0A/g')
  echo "::error title=${name} failed::${msg}"
  exit 1
fi
cat "$log"
