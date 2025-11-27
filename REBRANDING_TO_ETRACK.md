# 🎨 App Rebranding: Geniki Taxydromiki → eTrack

## Summary
The application has been rebranded from "Geniki Taxydromiki" to **"eTrack"** - a modern, professional name for the order management system.

---

## ✅ Changes Made

### 📱 User-Facing Updates

#### 1. **Browser Title & Metadata**
- `frontend/app/layout.tsx`
  - Title: `NEXUS | Order Management` → **`eTrack | Order Management`**
  - Description: Updated to focus on features rather than courier name

#### 2. **Login Page**
- `frontend/app/login/page.tsx`
  - Tagline: Updated to "Streamline your shipping workflow with automated label creation and Oblio invoicing"
  - Removes specific courier branding

#### 3. **Package Information**
- `package.json`
  - Name: `geniki-shopify-app` → **`etrack-shopify-app`**
  - Description: **"eTrack - Automated shipping and invoicing for Shopify"**

#### 4. **HTML Files**
- `public/index.html`
  - Title: **`eTrack - Order Management System`**

#### 5. **Documentation**
- `readme.md`
  - Main heading: **`eTrack - Order Management System`**
  - Description: "Complete shipping label automation and invoicing for your e-commerce business"

---

## 📝 What Stayed the Same

### Integration Names (Correctly Preserved)
The following references to "Geniki Taxydromiki" were **intentionally kept** because they refer to the courier service integration, not the app name:

1. **Settings Page**
   - Integration card: "Geniki Taxydromiki" (the courier service)
   - Configuration fields: Username, Password, App Key, WSDL URL

2. **Orders Page**
   - "Send labels to Geniki Taxydromiki" (the actual courier company)

3. **Backend Code**
   - API functions that interact with Geniki courier service
   - Database columns for Geniki credentials
   - Comments and documentation about the integration

4. **Environment Variables**
   - `GENIKI_USERNAME`, `GENIKI_PASSWORD`, `GENIKI_APPKEY` (courier credentials)

5. **Documentation**
   - Technical docs referring to Geniki API integration
   - Setup instructions for Geniki courier service

---

## 🎯 Brand Identity

### App Name: **eTrack**
- Modern, professional, memorable
- Suggests: electronic tracking, e-commerce tracking
- Clean, simple, international

### Value Proposition
- **Before**: "Geniki Taxydromiki integration for Shopify"
- **After**: "Automated shipping and invoicing for your e-commerce business"

### Focus
- Multi-courier support (not just one courier)
- Comprehensive order management
- Automation and efficiency
- Professional invoicing (Oblio)
- Scalable for multiple workspaces

---

## 🚀 What Users See Now

### On Login:
```
eTrack
────────────────────────────
Sign in to your account

Streamline your shipping workflow with 
automated label creation and Oblio invoicing

[Email input]
[Password input]
[Sign In button]
```

### In Browser Tab:
```
eTrack | Order Management
```

### In App Listings:
```
Name: eTrack
Description: Automated shipping and invoicing for Shopify
```

---

## 🔍 Technical Notes

### No Breaking Changes
- All API endpoints remain the same
- Database schema unchanged
- Environment variables unchanged
- Integration logic unchanged
- Authentication system unchanged

### Separation of Concerns
The rebranding correctly separates:
- **App branding** (eTrack) - what users see
- **Integration names** (Geniki, Oblio, etc.) - technical service names

---

## 📊 Before & After

| Location | Before | After |
|----------|--------|-------|
| Browser Tab | NEXUS \| Order Management | **eTrack \| Order Management** |
| Login Page | Geniki Taxydromiki integration | Automated shipping and invoicing |
| Package Name | geniki-shopify-app | **etrack-shopify-app** |
| README Title | Geniki Taxydromiki - Shopify | **eTrack - Order Management System** |
| Settings (Integration) | Geniki Taxydromiki | Geniki Taxydromiki *(unchanged - correct)* |

---

## ✨ Benefits of New Name

1. **Professional**: Sounds like an established SaaS product
2. **Scalable**: Works for multi-courier support
3. **Clear**: Immediately suggests tracking/e-commerce
4. **Brandable**: Easy to remember, type, and say
5. **International**: No language-specific terms
6. **Modern**: Short, punchy, tech-forward

---

## 🎉 Result

The app is now branded as **eTrack** throughout all user-facing elements, while maintaining proper technical references to Geniki Taxydromiki as a courier service integration.

**Status: Complete ✅**

