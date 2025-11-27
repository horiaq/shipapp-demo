# GitHub Personal Access Token Setup Guide

## Step 1: Create a Personal Access Token

1. **Go to GitHub Settings**
   - Visit: https://github.com/settings/tokens
   - Or: Click your profile picture → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**
   - Click **"Generate new token"** → **"Generate new token (classic)"**

3. **Configure Token**
   - **Note/Name**: `Hetzner Deployment for Shippy WMS`
   - **Expiration**: Choose your preference (30 days, 60 days, 90 days, or No expiration)
   - **Select scopes**: Check **`repo`** (Full control of private repositories)
     - This gives access to code, commit status, deployment status, and more

4. **Generate and Copy**
   - Click **"Generate token"** at the bottom
   - **IMPORTANT**: Copy the token immediately! You won't be able to see it again
   - Token format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Deploy Using the Token

### Option A: Interactive (Prompted for Token)

```bash
cd "/Users/horiaq/Desktop/Dev Projects/Geniki Taxydromiki"
./deploy-with-token.sh
```

The script will prompt you to enter your token.

### Option B: Pass Token as Argument

```bash
cd "/Users/horiaq/Desktop/Dev Projects/Geniki Taxydromiki"
./deploy-with-token.sh ghp_your_token_here
```

## Step 3: Verify Deployment

After deployment completes, visit:
- **Frontend**: http://91.98.94.41
- **Backend API**: http://91.98.94.41/api

## Security Notes

- ✅ The script removes the token from git config after cloning (for security)
- ✅ The token is never saved on the server
- ✅ Store your token securely (password manager)
- ⚠️ Never commit your token to the repository
- ⚠️ If token is compromised, revoke it immediately at: https://github.com/settings/tokens

## Alternative: Make Repository Public

If you prefer not to use a token, you can make the repository public:

1. Go to: https://github.com/horiaq/shipapp-demo/settings
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make public"

Then use the original deployment script without a token.

## Troubleshooting

### "Bad credentials" error
- Token may be invalid or expired
- Regenerate token and try again

### "Repository not found" error
- Check token has `repo` scope
- Verify repository name is correct

### Token expired
- Generate a new token
- Run deployment script again with new token

## Token Management

To revoke or manage tokens:
- Visit: https://github.com/settings/tokens
- Click on the token name
- Click "Delete" or "Regenerate"

