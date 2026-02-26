#!/bin/bash
# Push Ascend project to new repository (branch: AscendV1)
# Adjust REMOTE_URL if your Ascend repo is under a different account/org

REMOTE_URL="https://github.com/gsush701-gif/Ascend.git"
REMOTE_NAME="ascend"

echo "=== 1. Adding remote 'ascend' (if not already added) ==="
git remote remove $REMOTE_NAME 2>/dev/null || true
git remote add $REMOTE_NAME $REMOTE_URL

echo ""
echo "=== 2. Creating branch AscendV1 from current branch ==="
git checkout -b AscendV1 2>/dev/null || git checkout AscendV1

echo ""
echo "=== 3. Staging all changes ==="
git add -A

echo ""
echo "=== 4. Committing (if there are changes) ==="
git status --short
if [ -n "$(git status --porcelain)" ]; then
  git commit -m "Ascend V1: UI consistency, design tokens, shared components"
else
  echo "Working tree clean - nothing to commit."
fi

echo ""
echo "=== 5. Pushing to ascend/AscendV1 ==="
git push -u $REMOTE_NAME AscendV1

echo ""
echo "Done! Your code is now at: $REMOTE_URL (branch: AscendV1)"
