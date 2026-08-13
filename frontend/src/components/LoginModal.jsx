import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function LoginModal({
  isOpen,
  onClose,
  title = "Sign In Required",
  message = "Please log in or create a free account to continue with your AI session."
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-purple-100 shadow-2xl relative text-center space-y-5"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 h-8 w-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>

          {/* Glowing Icon Container */}
          <div className="mx-auto h-16 w-16 rounded-2xl bg-purple-100/80 border border-purple-200 text-[#6B46C1] flex items-center justify-center text-3xl shadow-sm">
            🔒
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] hover:from-[#5b3da6] hover:to-[#4a2e8e] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              Log In to Continue
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full py-3 bg-purple-50 hover:bg-purple-100 text-[#6B46C1] font-bold text-sm rounded-2xl border border-purple-200/80 transition-all cursor-pointer"
            >
              Create Free Account
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
