import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getBlogPost, BLOG_POSTS } from '../data/blogPosts';
import { useSeo } from '../hooks/useSeo';

function Block({ block }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="text-2xl font-extrabold text-black tracking-tight mt-10 mb-4">{block.text}</h2>;
    case 'list':
      return (
        <ul className="list-disc pl-5 space-y-2 my-5">
          {block.items.map((item, i) => (
            <li key={i} className="text-slate-600 text-base leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    case 'p':
    default:
      return <p className="text-slate-600 text-base leading-[1.8] mb-5">{block.text}</p>;
  }
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = getBlogPost(slug);

  // useSeo is a hook — must run unconditionally on every render, so the
  // null-post case gets empty/undefined values here and the actual
  // "redirect away" happens afterward, once hook ordering is satisfied.
  useSeo({
    title: post ? `${post.title} — MockMate AI Blog` : undefined,
    description: post?.excerpt,
    path: post ? `/blog/${post.slug}` : undefined,
    jsonLd: post ? {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      datePublished: post.date,
      dateModified: post.date,
      author: { '@type': 'Organization', name: 'MockMate AI' },
      publisher: { '@type': 'Organization', name: 'MockMate AI' },
      mainEntityOfPage: `https://www.mockmate.live/blog/${post.slug}`,
    } : undefined,
  });

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const morePosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto"
      >
        <button
          onClick={() => navigate('/blog')}
          className="text-sm font-bold text-slate-400 hover:text-[var(--brand-primary)] transition-colors mb-8"
        >
          ← Back to Blog
        </button>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-[var(--brand-light)] text-[var(--brand-primary)] border-transparent">
            {post.category}
          </span>
          <time className="text-xs font-semibold text-slate-400">
            {new Date(post.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </time>
          <span className="text-xs font-semibold text-slate-300">·</span>
          <span className="text-xs font-semibold text-slate-400">{post.readTime}</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-black mb-10 leading-[1.15]">
          {post.title}
        </h1>

        <div>
          {post.content.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-slate-100 bg-white rounded-3xl p-7 border border-black/[0.05] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-base font-extrabold text-black mb-1">Ready to put this into practice?</p>
            <p className="text-sm text-slate-500">Run a mock interview or a live DSA session with MockMate AI.</p>
          </div>
          <button
            onClick={() => navigate('/setup')}
            className="px-6 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] shadow-md shadow-purple-900/20 transition-all hover:scale-[1.03] flex-shrink-0"
          >
            Start Practicing →
          </button>
        </div>

        {morePosts.length > 0 && (
          <div className="mt-16">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">More from the blog</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {morePosts.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => navigate(`/blog/${p.slug}`)}
                  className="text-left bg-white border border-black/[0.05] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[var(--brand-primary)]/30 transition-all"
                >
                  <p className="text-sm font-extrabold text-black leading-snug mb-1">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.readTime}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.article>

      <Footer />
    </div>
  );
}
