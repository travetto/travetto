name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - main
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 22
      - name: Install monorepo deps
        run: npm ci
      - name: Build monorepo
        run: npx trvc build
      - name: Install dependencies & Build UI
        run: |
          cd ui
          npm ci
          npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: <your-project-id>
