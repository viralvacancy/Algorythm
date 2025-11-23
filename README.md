<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1_ooG_j52xY0PccGtw4tl1GOLr_cWPqDm

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Troubleshooting

### Git pull shows "untracked working tree files would be overwritten"

GitHub Desktop (and the git CLI) will stop a pull if there are local files that are not tracked by git but would be changed or removed by the incoming update. In this repo the message typically appears when `package-lock.json` exists locally but is missing from the remote branch. To continue:

1. Check which untracked files are listed in the error dialog (e.g., `package-lock.json`).
2. If you do not need those files, delete them from your working directory.
3. Alternatively, if you want to keep them, move them somewhere safe outside the repository.
4. Re-run **Pull** in GitHub Desktop once the conflicting untracked files are removed.

This protects you from unintentionally losing files that git is not tracking.
