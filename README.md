# Note App

A modern, feature-rich note-taking Progressive Web App (PWA) designed for iPhone, similar to Evernote. Save it to your home screen and use it like a native app - completely free, no app store required!

## ✨ Features

### 📝 Rich Text Editing
- **Full formatting**: Bold, italic, underline, strikethrough
- **Text alignment**: Left, center, right, justify
- **Lists**: Bullet points, numbered lists, nested lists, checkboxes
- **Content**: Images, links, tables, code blocks, blockquotes
- **Colors**: Text color and highlight color
- **Mobile-optimized toolbar** for easy editing on iPhone

### 📱 Custom Tab System
- **6 Default Tabs**: Scratch, Now, Short-Term, Long-term, All Notes, More
- **Dynamic tabs**: Create new notes that appear in new tabs
- **Renamable tabs**: Customize tab names to fit your workflow
- **Lock/Unlock**: Lock tabs to prevent accidental changes
- **Reorder**: Drag and drop tabs when unlocked

### 📚 Notebook System
- **Multiple notebooks**: Create separate workspaces (Work, Personal, etc.)
- **Isolated data**: Each notebook has its own notes and tabs
- **Easy switching**: Switch between notebooks from the More tab
- **Custom naming**: Name notebooks whatever you want

### 🎨 Themes
- **4 Beautiful themes**: Dark, Light, Purple, Blue
- **Switch anytime**: Change themes from the More tab
- **Persistent**: Your theme preference is saved

### ☁️ Cloud Sync
- **Automatic sync**: Notes sync to Firebase cloud automatically
- **Offline support**: Works offline, syncs when online
- **Real-time**: Changes sync across devices instantly
- **Secure**: Your data is encrypted and private

### 📸 Image Support
- **Camera**: Take photos directly from the app
- **Gallery**: Choose existing photos from your phone
- **In-note display**: Images appear inline with your text
- **Optimized**: Images are compressed to save storage

### 🔍 Search & Organization
- **Search all notes**: Global search across all notebooks
- **Search in note**: Find text within a specific note
- **All Notes tab**: View all notes in one place
- **Date tracking**: See when notes were last updated

### 🗑️ Trash & Recovery
- **Safe deletion**: Deleted notes go to Trash (not permanently deleted)
- **30-day retention**: Notes stay in Trash for 30 days
- **Restore**: Restore deleted notes anytime
- **Permanent delete**: Manually delete from Trash if needed

### 📤 Export & Share
- **Export formats**: PDF, Markdown, HTML
- **Email notes**: Send notes via email
- **Screenshot**: Save note as image to phone
- **Copy link**: Share notes with links

### ⚙️ Settings & More
- **Storage usage**: See how much cloud storage you're using
- **Sync status**: Check last sync time and status
- **Force sync**: Manually trigger cloud sync
- **Export all data**: Backup all your notebooks
- **Account management**: View and manage your profile

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Firebase account (free)
- Git installed

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Note
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [firebase.google.com](https://firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Set up Storage bucket
   - Copy your Firebase config

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables
   - Deploy!

3. **Install on iPhone**
   - Open the deployed URL in Safari
   - Tap the Share button
   - Select "Add to Home Screen"
   - Use it like a native app!

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Rich Text Editor**: TipTap
- **Backend**: Firebase (Firestore, Storage, Auth)
- **Hosting**: Vercel
- **PWA**: Next.js PWA support

## 📁 Project Structure

```
note/
├── src/
│   ├── app/              # Next.js app directory (routing)
│   ├── components/       # React components
│   │   ├── editor/       # Rich text editor
│   │   ├── notes/        # Note components
│   │   ├── ui/           # UI components
│   │   └── layout/       # Layout components
│   ├── lib/              # Utilities & configs
│   │   ├── firebase/     # Firebase setup
│   │   ├── utils/        # Helper functions
│   │   └── types/        # TypeScript types
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React contexts
│   └── styles/           # Global styles
├── public/               # Static files
└── package.json          # Dependencies
```

## 🔒 Security

- User authentication via Firebase Auth
- Firestore security rules ensure users can only access their own data
- All data is encrypted in transit and at rest
- No data is shared with third parties

## 💰 Cost

**Completely Free!**
- Firebase free tier: 1GB storage, 50K reads/day, 20K writes/day
- Vercel free tier: Unlimited projects, 100GB bandwidth/month
- Perfect for personal use

## 📱 PWA Features

- **Installable**: Save to iPhone home screen
- **Offline support**: Works without internet
- **Fast loading**: Optimized for mobile
- **App-like experience**: Full screen, no browser UI

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

Private project - All rights reserved

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Firebase](https://firebase.google.com/)
- Hosted on [Vercel](https://vercel.com/)
- Rich text editing by [TipTap](https://tiptap.dev/)

---

**Made with ❤️ for personal productivity**

