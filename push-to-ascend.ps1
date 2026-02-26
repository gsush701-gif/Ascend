# Push Ascend project to new repository (branch: AscendV1)
# Adjust REMOTE_URL if your Ascend repo is under a different account/org

$REMOTE_URL = "https://github.com/gsush701-gif/Ascend.git"
$REMOTE_NAME = "ascend"

Write-Host "=== 1. Adding remote 'ascend' ===" -ForegroundColor Cyan
git remote remove $REMOTE_NAME 2>$null
git remote add $REMOTE_NAME $REMOTE_URL

Write-Host "`n=== 2. Creating branch AscendV1 ===" -ForegroundColor Cyan
$branchExists = git branch --list AscendV1
if (-not $branchExists) {
  git checkout -b AscendV1
} else {
  git checkout AscendV1
}
#git changes
Write-Host "`n=== 3. Staging all changes ===" -ForegroundColor Cyan
git add -A

Write-Host "`n=== 4. Committing (if there are changes) ===" -ForegroundColor Cyan
$status = git status --porcelain
if ($status) {
  git commit -m "Ascend V1: UI consistency, design tokens, shared components"
} else {
  Write-Host "Working tree clean - nothing to commit."
}

Write-Host "`n=== 5. Pushing to ascend/AscendV1 ===" -ForegroundColor Cyan
git push -u $REMOTE_NAME AscendV1

Write-Host "`nDone! Your code is now at: $REMOTE_URL (branch: AscendV1)" -ForegroundColor Green
