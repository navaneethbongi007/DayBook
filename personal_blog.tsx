import React, { useState, useEffect } from 'react';
import { BookOpen, PenTool, X, Check, Trash2, Clock, User } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

// Initialize Firebase using environment variables provided by the platform
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Helper to estimate reading time based on word count (avg 200 words/min)
const getReadingTime = (text) => {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
};

// Helper to format timestamps gracefully
const formatDate = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export default function BlogApp() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('feed'); // 'feed' | 'write'
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 1. Initialize Authentication (Rule 3)
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // 2. Fetch Data only if user is authenticated
    if (!user) return;

    // Use strict path for public data (Rule 1)
    const postsRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
    
    // No complex queries (Rule 2) - we will sort in memory
    const unsubscribe = onSnapshot(postsRef, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in memory by createdAt descending
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt);
      
      setPosts(fetchedPosts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) return;
    if (!user) return;

    setIsSubmitting(true);
    try {
      const postsRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
      await addDoc(postsRef, {
        title: title.trim(),
        content: content.trim(),
        createdAt: Date.now(),
        authorId: user.uid
      });
      
      // Reset form and go back to feed
      setTitle('');
      setContent('');
      setView('feed');
    } catch (error) {
      console.error("Error publishing post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!user) return;
    try {
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
      await deleteDoc(postRef);
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const cardColors = [
    'bg-rose-100 border-rose-300 shadow-rose-200/50 text-rose-900',
    'bg-sky-100 border-sky-300 shadow-sky-200/50 text-sky-900',
    'bg-emerald-100 border-emerald-300 shadow-emerald-200/50 text-emerald-900',
    'bg-amber-100 border-amber-300 shadow-amber-200/50 text-amber-900',
    'bg-fuchsia-100 border-fuchsia-300 shadow-fuchsia-200/50 text-fuchsia-900',
    'bg-indigo-100 border-indigo-300 shadow-indigo-200/50 text-indigo-900'
  ];

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <BookOpen className="w-16 h-16 text-purple-500 mb-4 animate-bounce" />
          <div className="h-4 w-32 bg-purple-300 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (view === 'write') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 font-sans selection:bg-pink-200 text-gray-800">
        <nav className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <button 
              onClick={() => setView('feed')}
              className="flex items-center text-white/90 hover:text-white transition-colors font-bold tracking-wide"
            >
              <X className="w-6 h-6 mr-1" />
              Cancel
            </button>
            <button 
              onClick={handlePublish}
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="flex items-center px-6 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold text-sm hover:from-yellow-300 hover:to-orange-400 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {isSubmitting ? 'Publishing...' : 'Publish Story'}
              {!isSubmitting && <Check className="w-5 h-5 ml-2" />}
            </button>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <input
            type="text"
            placeholder="Give it a catchy title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-500 bg-transparent border-none outline-none placeholder-purple-300 mb-8"
            autoFocus
          />
          <textarea
            placeholder="What's on your colorful mind today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full text-xl leading-relaxed text-gray-800 bg-transparent border-none outline-none placeholder-gray-400 min-h-[60vh] resize-none"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-purple-50 to-pink-50 font-sans selection:bg-purple-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner border border-white/30">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Chronicles</h1>
              <p className="text-xs text-white/80 font-bold tracking-widest uppercase">My Vibrant Life</p>
            </div>
          </div>
          <button 
            onClick={() => setView('write')}
            className="flex items-center px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 rounded-full font-bold text-sm hover:from-yellow-300 hover:to-orange-300 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <PenTool className="w-4 h-4 mr-2" />
            Write
          </button>
        </div>
      </header>

      {/* Main Content Feed */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-20 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl">
            <div className="w-24 h-24 bg-gradient-to-tr from-pink-300 to-violet-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <PenTool className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600 mb-3">No stories yet!</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              Your vibrant journal awaits. Splash some words onto the canvas and share your day!
            </p>
            <button 
              onClick={() => setView('write')}
              className="px-8 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
            >
              Write your first entry
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {posts.map((post, index) => {
              const colorClass = cardColors[index % cardColors.length];
              return (
                <article 
                  key={post.id} 
                  className={`group relative p-8 md:p-10 rounded-3xl shadow-lg border-2 ${colorClass} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
                >
                  {/* Meta Info */}
                  <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                    <div className="flex flex-wrap items-center text-sm font-bold opacity-80 space-x-4 bg-white/40 px-4 py-2 rounded-full backdrop-blur-sm">
                      <span className="flex items-center">
                        <User className="w-4 h-4 mr-1.5" />
                        {post.authorId.substring(0, 8)}...
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1.5" />
                        {formatDate(post.createdAt)}
                      </span>
                      <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                      <span>{getReadingTime(post.content)}</span>
                    </div>
                    
                    {/* Delete button */}
                    {user.uid === post.authorId && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 text-red-500 hover:text-white bg-white/50 hover:bg-red-500 rounded-full shadow-sm"
                        title="Delete story"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight drop-shadow-sm">
                    {post.title}
                  </h2>
                  <div className="prose max-w-none">
                    <p className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap font-medium opacity-90">
                      {post.content}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}