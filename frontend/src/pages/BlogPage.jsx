import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BLOG_POSTS } from '../data/blogPosts';
import { useSeo } from '../hooks/useSeo';

const CATEGORY_STYLES = {
  'Interview Prep': 'bg-purple-50 text-purple-600 border-purple-100',
  'DSA': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Resumes': 'bg-amber-50 text-amber-700 border-amber-100',
};

export default function BlogPage() {
  const navigate = useNavigate();
  const posts = [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));

  useSeo({
    title: 'Blog — MockMate AI',
    description: 'Practical, no-fluff advice on technical interview prep, DSA practice, and resume optimization from the MockMate AI team.',
    path: '/blog',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'MockMate AI Blog',
      url: 'https://www.mockmate.live/blog',
      blogPost: posts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.excerpt,
        datePublished: p.date,
        url: `https://www.mockmate.live/blog/${p.slug}`,
      })),
    },
  });

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      <header className="max-w-2xl mx-auto text-center mb-16">
        <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-6">
          ✍️ Blog
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
          Interview prep, actually explained
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          Practical advice on technical interviews, DSA practice, and resumes — no filler, nothing you couldn't put to use today.
        </p>
      </header>

      <section className="max-w-3xl mx-auto grid grid-cols-1 gap-5 mb-32">
        {posts.map((post, i) => (
          <motion.article
            key={post.slug}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            onClick={() => navigate(`/blog/${post.slug}`)}
            className="bg-white border border-black/[0.05] rounded-3xl p-7 shadow-sm hover:shadow-md hover:border-[var(--brand-primary)]/30 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${CATEGORY_STYLES[post.category] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {post.category}
              </span>
              <time className="text-xs font-semibold text-slate-400">
                {new Date(post.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </time>
              <span className="text-xs font-semibold text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-400">{post.readTime}</span>
            </div>
            <h2 className="text-xl font-extrabold text-black tracking-tight mb-2 leading-snug">
              {post.title}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              {post.excerpt}
            </p>
            <span className="text-sm font-bold text-[var(--brand-primary)]">
              Read article →
            </span>
          </motion.article>
        ))}
      </section>

      <Footer />
    </div>
  );
}
