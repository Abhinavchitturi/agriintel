"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Leaf, CheckCircle } from "lucide-react"

export default function EmailConfirmedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center"
      >
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-agri-500 to-agri-700 flex items-center justify-center shadow-lg">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-gray-900 dark:text-white">AgriIntel</span>
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-10 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-agri-100 dark:bg-agri-900/40 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-agri-600 dark:text-agri-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Email confirmed!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Your account is ready. Sign in to start getting AI-powered farming guidance.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl bg-gradient-to-r from-agri-600 to-agri-700 text-white font-semibold hover:from-agri-700 hover:to-agri-800 transition-all shadow-md"
          >
            Sign In to AgriIntel
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
