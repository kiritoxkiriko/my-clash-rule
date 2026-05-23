#!/usr/bin/env bash
set -euo pipefail

input_dir="rules-singbox"
output_dir="rules-singbox-srs"

mkdir -p "$output_dir"

for source in "$input_dir"/*.json; do
  name="$(basename "$source" .json)"
  sing-box rule-set compile "$source" -o "$output_dir/$name.srs"
done
