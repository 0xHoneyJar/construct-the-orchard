#!/usr/bin/env bash
# Post-install hook — runs after construct installation
# Use this for setup tasks like creating directories, checking dependencies, etc.
set -euo pipefail

CONSTRUCT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create output directory if your construct writes research/reports
# mkdir -p "$CONSTRUCT_DIR/scripts/research-output"

# CUSTOMIZE: Check for required API keys
# Uncomment and modify for your construct's credential needs
# if [ -f .env ]; then
#   if grep -q "MY_API_KEY" .env; then
#     echo "  API key found"
#   else
#     echo "  WARNING: No MY_API_KEY found in .env"
#     echo "  Set it in .env or ~/.loa/credentials.json"
#   fi
# else
#   echo "  NOTE: No .env file found. Scripts will check ~/.loa/credentials.json as fallback."
# fi

echo "  My Construct installed successfully"
echo ""
echo "  Quick start: /example-command"
