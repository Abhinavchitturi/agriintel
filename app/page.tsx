'use client'

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Zap, Leaf, Shield, ArrowRight, ChevronDown, Globe, Bot, TrendingUp, Target, Layers, LogOut, MessageSquare, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser, signOut as authSignOut, type User } from "@/lib/auth"

const features = [
  {
    icon: Bot,
    title: "Groq Ultra-Fast AI",
    desc: "Powered by Llama 3.3 70B on Groq LPU - sub-second inference for real-time agricultural insights",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Leaf,
    title: "Crop-Specific Intelligence",
    desc: "Tailored recommendations for 50+ crops including planting windows, nutrient needs, pest management",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Zap,
    title: "Real-Time Weather Data",
    desc: "Live weather forecasts via OpenWeatherMap with temperature, humidity, precipitation, and wind data for any Indian location",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Shield,
    title: "RAG-Enhanced Accuracy",
    desc: "Retrieval-Augmented Generation with curated agricultural documents and research for more accurate, grounded answers",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Target,
    title: "Precision Farming",
    desc: "Field-level insights: soil pH optimization, NPK recommendations, irrigation scheduling, harvest timing",
    color: "from-indigo-500 to-purple-500",
  },
  {
    icon: TrendingUp,
    title: "Yield Optimization",
    desc: "Data-driven strategies to maximize productivity, reduce input costs, and improve sustainability metrics",
    color: "from-teal-500 to-green-500",
  },
]

const stats = [
  { value: "<1s", label: "Avg Response Time", icon: Zap },
  { value: "50+", label: "Supported Crops", icon: Leaf },
  { value: "8", label: "Languages", icon: Globe },
  { value: "24/7", label: "Available", icon: TrendingUp },
]



const DEMO_SCRIPT = [
  { role: "user", text: "What crops should I grow in Maharashtra this kharif season?" },
  {
    role: "assistant",
    lines: [
      "Best kharif crops for Maharashtra:",
      "• Soybean — 90 days, highest ROI, sow by 15 June",
      "• Cotton — 150 days, good MSP, rain-fed suitable",
      "• Tur (pigeon pea) — drought tolerant, 150 days",
      "• Maize — 75 days, great for intercropping",
      "",
      "NPK basal dose: 25:50:25 kg/ha at sowing.",
      "Confidence: High ✓",
    ],
  },
  { role: "user", text: "Any pest risk for soybean right now?" },
  {
    role: "assistant",
    lines: [
      "⚠ High alert for June–July in Vidarbha & Marathwada:",
      "• Stem fly — scout at 7-day intervals",
      "• Girdle beetle — threshold: 1 fly/plant before 15 DAS",
      "",
      "Action:",
      "• Imidacloprid 70 WS seed treatment before sowing",
      "• Neem oil 1500 ppm spray at 25 DAS if population rises",
      "",
      "Confidence: High ✓",
    ],
  },
]

const DEMO_STEPS = [300, 900, 2700, 3500, 4300, 6100, 6900]

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [showDemo, setShowDemo] = useState(false)
  const [demoStep, setDemoStep] = useState(0)

  useEffect(() => {
    setUser(getCurrentUser())
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!showDemo) { setDemoStep(0); return }
    const timers = DEMO_STEPS.map((delay, i) =>
      setTimeout(() => setDemoStep(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [showDemo])

  const handleSignOut = () => {
    authSignOut()
    setUser(null)
    setShowProfileMenu(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex h-full items-center">
            {/* Logo — flex-1 pushes links to true center */}
            <div className="flex-1 flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-agri-600 flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold text-xl text-gray-900 dark:text-white hidden sm:block">
                  AgriIntel
                </span>
              </Link>
            </div>

            {/* Nav links — truly centered */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-agri-600 dark:hover:text-agri-400 transition-colors">
                Features
              </Link>
              <Link href="#demo" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-agri-600 dark:hover:text-agri-400 transition-colors">
                Demo
              </Link>
              <Link href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-agri-600 dark:hover:text-agri-400 transition-colors">
                Pricing
              </Link>
              <Link href="#docs" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-agri-600 dark:hover:text-agri-400 transition-colors">
                Docs
              </Link>
            </div>

            {/* Right side — flex-1 + justify-end mirrors the left */}
            <div className="flex-1 flex items-center justify-end gap-3">
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 py-1 pl-1 pr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-agri-600 text-white flex items-center justify-center text-sm font-bold select-none">
                      {user.name[0].toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                      {user.name.split(" ")[0]}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showProfileMenu ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {showProfileMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden z-50"
                      >
                        {/* User info header */}
                        <div className="px-4 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-agri-600 text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                              {user.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="mt-2.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              user.plan === "pro"
                                ? "bg-agri-100 dark:bg-agri-900/60 text-agri-700 dark:text-agri-300"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }`}>
                              {user.plan === "pro" ? <><Sparkles className="w-2.5 h-2.5" /> Pro Plan</> : "Free Plan"}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="py-1">
                          <button
                            onClick={() => { window.location.href = "/chat"; setShowProfileMenu(false) }}
                            className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            Open Chat
                          </button>
                          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                          <button
                            onClick={handleSignOut}
                            className="w-full px-4 py-2.5 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-3 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="hidden sm:flex text-gray-700 dark:text-gray-200" onClick={() => window.location.href = "/login"}>
                    Sign In
                  </Button>
                  <Button size="sm" className="hidden sm:flex bg-agri-600 hover:bg-agri-700 text-white shadow-sm" onClick={() => window.location.href = "/signup"}>
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-agri-50/50 via-transparent to-transparent dark:from-agri-950/20 dark:via-transparent" />
        
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(34,197,94,0.09),transparent)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-agri-50/80 dark:bg-agri-950/50 px-4 py-1.5 mb-8 border border-agri-200/50 dark:border-agri-800/50"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-agri-500"
              />
              <span className="text-sm font-medium text-agri-700 dark:text-agri-300">
                Powered by Groq LPU™ • Sub-second inference • Llama 3.3 70B
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white mb-6"
            >
              AI-Powered Agricultural
              <br />
              <span className="bg-gradient-to-r from-agri-600 via-agri-500 to-emerald-500 bg-clip-text text-transparent">
                Intelligence
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Get instant, precise farming guidance with the world's fastest AI. From weather forecasts to crop optimization — ask any agriculture question and get expert answers in under a second.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Button
                size="lg"
                className="group w-full sm:w-auto px-8 py-4 text-lg bg-gradient-to-r from-agri-600 to-agri-700 hover:from-agri-700 hover:to-agri-800 shadow-xl shadow-agri-500/30 hover:shadow-agri-500/50 transition-all duration-300"
                onClick={() => window.location.href = "/signup"}
              >
                Try AgriIntel Free
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              <button
                onClick={() => setShowDemo(true)}
                className="group w-full sm:w-auto px-8 py-4 text-lg font-semibold rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-agri-300 dark:hover:border-agri-700 hover:bg-agri-50/50 dark:hover:bg-agri-950/30 transition-all flex items-center justify-center gap-3"
              >
                <span className="w-9 h-9 rounded-full bg-agri-100 dark:bg-agri-900/60 flex items-center justify-center group-hover:bg-agri-200 dark:group-hover:bg-agri-800/60 transition-colors flex-shrink-0">
                  <Play className="w-4 h-4 text-agri-600 dark:text-agri-400 ml-0.5" />
                </span>
                Watch Demo
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Secure by Design
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                {'<'} 1s Latency
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                8 Languages
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                RAG Enhanced
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="max-w-4xl mx-auto mt-6 rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200/60 dark:divide-gray-800/60"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
                className="text-center px-6 py-7 hover:bg-agri-50/30 dark:hover:bg-agri-950/20 transition-colors"
              >
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white font-display">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-gray-300 dark:border-gray-600 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32 bg-background relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-agri-50 dark:bg-agri-950/50 text-agri-700 dark:text-agri-300 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Why AgriIntel?
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Built for Modern Agriculture
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Every feature designed to help farmers, agronomists, and agribusinesses make better decisions, faster.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-agri-300/50 dark:hover:border-agri-700/50 transition-all duration-300 hover:shadow-xl hover:shadow-agri-500/10 hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${feature.color}`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-agri-500/5 via-transparent to-blue-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-agri-50 dark:bg-agri-950/50 text-agri-700 dark:text-agri-300 text-sm font-medium mb-4">
                <Zap className="w-4 h-4" />
                Live Demo
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                Ask Anything About Farming
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                Type a question below and see AgriIntel's ultra-fast response powered by Groq's LPU inference engine.
              </p>
              
              <div className="space-y-3">
                {[
                  "What's the optimal planting window for wheat in Punjab?",
                  "How do I manage aphid infestation on cotton organically?",
                  "What fertilizer schedule for tomato in hydroponics?",
                  "Will it rain in the next 7 days in Maharashtra?",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setShowDemo(true)}
                    className="w-full text-left p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-agri-300 dark:hover:border-agri-700 hover:bg-agri-50 dark:hover:bg-agri-950/50 transition-all text-gray-700 dark:text-gray-200 text-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                    AgriIntel Chat
                  </div>
                  <Bot className="w-5 h-5 text-agri-500" />
                </div>
                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 max-w-xs">
                        <p className="text-sm text-gray-700 dark:text-gray-200">What crops grow best in current weather conditions in Karnataka?</p>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 ml-1">Just now</div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="flex-1 text-right">
                      <div className="bg-gradient-to-r from-agri-600 to-agri-700 rounded-2xl p-4 max-w-xs ml-auto text-white text-sm">
                        <p className="font-medium mb-2">Based on current conditions in Karnataka:</p>
                        <ul className="space-y-1 text-sm opacity-90">
                          <li>• Rice (Kharif) - Optimal temp 25-30°C</li>
                          <li>• Ragi - Drought tolerant, 60-90 days</li>
                          <li>• Maize - Good with current rainfall</li>
                          <li>• Pulses - Nitrogen fixing, soil health</li>
                        </ul>
                        <div className="mt-3 pt-3 border-t border-agri-500/30 flex items-center gap-2 text-xs">
                          <Zap className="w-3 h-3" />
                          <span>Generated in 0.42s via Groq</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 mr-1">0.42s</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-agri-500 to-agri-700 flex-shrink-0 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask about crops, weather, soil..."
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/20"
                    />
                    <Button className="bg-agri-600 hover:bg-agri-700 px-4">
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-agri-50 dark:bg-agri-950/50 text-agri-700 dark:text-agri-300 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Simple Pricing
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Start Free, Scale When Ready
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              No hidden fees. Cancel anytime. All plans include Groq-powered AI responses.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "forever",
                planKey: "free",
                description: "Get basic answers to your farming questions — plain and simple.",
                color: "from-gray-500 to-gray-600",
                highlight: false,
                features: [
                  "20 requests per 6-hour window",
                  "Quick, concise answers",
                  "Basic crop guidance",
                  "English language",
                  "Community support",
                ],
                cta: "Get Started Free",
                ctaStyle: "border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200",
                href: "/signup",
              },
              {
                name: "Pro",
                price: "₹299",
                period: "per month",
                planKey: "pro",
                description: "For serious farmers who want complete, expert-level structured guidance.",
                color: "from-agri-500 to-emerald-500",
                highlight: true,
                features: [
                  "Up to 200 requests per 3-hour window",
                  "Multiple AI model tiers",
                  "Full markdown formatted answers",
                  "Stage-wise crop schedules & NPK doses",
                  "8 regional languages",
                  "RAG-enhanced accuracy",
                  "Real-time weather integration",
                  "Pest & disease alert plans",
                  "Priority support",
                ],
                cta: "Upgrade to Pro",
                ctaStyle: "bg-gradient-to-r from-agri-600 to-agri-700 hover:from-agri-700 hover:to-agri-800 text-white shadow-xl shadow-agri-500/30",
                href: "/signup?plan=pro",
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:shadow-2xl ${
                  plan.highlight
                    ? "bg-white dark:bg-gray-900 border-agri-300 dark:border-agri-700 shadow-xl shadow-agri-500/10 scale-105"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-agri-200 dark:hover:border-agri-800"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-agri-500 to-emerald-500 text-white text-sm font-semibold shadow-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                  <Leaf className="w-5 h-5 text-white" />
                </div>

                <h3 className="font-display text-xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white font-display">{plan.price}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">/{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <div className="w-4 h-4 rounded-full bg-agri-100 dark:bg-agri-900/50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-agri-600 dark:text-agri-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => { window.location.href = (plan as { href?: string }).href || "/signup" }}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 ${plan.ctaStyle}`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10"
          >
            All prices in INR. GST extra. Cancel anytime. No credit card required for free tier.
          </motion.p>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-24 sm:py-32 relative overflow-hidden">

        <div className="absolute inset-0 bg-gradient-to-br from-agri-600 via-agri-700 to-emerald-700" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Ready to Transform Your Farming?
            </h2>
            <p className="text-lg sm:text-xl text-agri-100 mb-10 max-w-2xl mx-auto">
              Join thousands of farmers and agronomists using AgriIntel for smarter, faster, more profitable agricultural decisions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => window.location.href = "/signup"}
                className="w-full sm:w-auto px-8 py-4 text-lg font-semibold rounded-xl bg-white text-agri-700 hover:bg-agri-50 shadow-xl transition-all flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.location.href = "/login"}
                className="w-full sm:w-auto px-8 py-4 text-lg font-semibold rounded-xl border-2 border-white/70 text-white hover:bg-white/10 transition-all"
              >
                Sign In
              </button>
            </div>
            <p className="mt-6 text-agri-200 text-sm">
              No credit card required • Free tier forever • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-agri-700 flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <span className="font-display font-bold text-xl text-gray-900 dark:text-white">AgriIntel</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xs">
                The world's fastest AI agricultural assistant. Powered by Groq LPU inference for sub-second responses.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-agri-500 transition-colors" aria-label="Twitter">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-agri-500 transition-colors" aria-label="GitHub">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-agri-500 transition-colors" aria-label="Discord">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.675 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.083.083 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-.062.077.077 0 0 0 .041-.106 13.107 13.107 0 0 0-.884-1.729 13.203 13.203 0 0 0 .232-.34.076.076 0 0 0-.043-.114c-1.173-1.715-1.79-3.786-1.79-6.031 0-4.276 3.083-7.764 7.195-8.094a.077.077 0 0 0 .018-.128 12.29 12.29 0 0 0 1.993-4.245.07.07 0 0 0-.042-.09 18.539 18.539 0 0 0-4.694-1.412.07.07 0 0 0-.085.037 6.953 6.953 0 0 0-.668 1.783A6.723 6.723 0 0 1 12.02 6.59c-.84.03-1.672.162-2.486.386a.077.077 0 0 0-.106.076 10.97 10.97 0 0 0-.482 2.567.077.077 0 0 0 .121.067c3.904-.073 7.19-3.195 7.19-7.128a.06.06 0 0 0-.031-.089zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Product</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                <li><a href="#features" className="hover:text-agri-500 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-agri-500 transition-colors">Pricing</a></li>
                <li><a href="#demo" className="hover:text-agri-500 transition-colors">Demo</a></li>
                <li><a href="/signup" className="hover:text-agri-500 transition-colors">Get Started</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Support</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                <li><a href="/login" className="hover:text-agri-500 transition-colors">Sign In</a></li>
                <li><a href="/signup" className="hover:text-agri-500 transition-colors">Create Account</a></li>
                <li><a href="#features" className="hover:text-agri-500 transition-colors">How It Works</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              © {new Date().getFullYear()} AgriIntel. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span>Made with Groq LPU</span>
              <span>•</span>
              <span>Next.js 14</span>
              <span>•</span>
              <span>TypeScript</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowDemo(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-agri-600 flex items-center justify-center">
                    <Leaf className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">AgriIntel Kisan Pro</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">Live demo • Maharashtra</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDemo(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat area */}
              <div className="p-5 space-y-4 min-h-[300px] max-h-[420px] overflow-y-auto">
                {/* Message 1 — user */}
                {demoStep >= 1 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                    <div className="bg-agri-600 text-white px-4 py-2.5 rounded-[18px] rounded-br-[4px] text-sm max-w-[80%] shadow-md shadow-agri-600/15">
                      {DEMO_SCRIPT[0].text}
                    </div>
                  </motion.div>
                )}

                {/* Typing after msg 1 */}
                {demoStep === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 rounded-full bg-agri-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-agri-100 dark:border-agri-900/40 px-4 py-3 rounded-[18px] rounded-bl-[4px]">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((d) => (
                          <motion.div key={d} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: d }} className="w-1.5 h-1.5 rounded-full bg-agri-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Message 2 — AI */}
                {demoStep >= 3 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 rounded-full bg-agri-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-agri-100 dark:border-agri-900/40 px-4 py-3 rounded-[18px] rounded-bl-[4px] text-sm max-w-[88%] shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-agri-600 dark:text-agri-400 mb-2 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Pro
                      </p>
                      {(DEMO_SCRIPT[1] as { lines: string[] }).lines.map((line, i) => (
                        <p key={i} className={`text-gray-700 dark:text-gray-200 leading-relaxed ${line === "" ? "mt-1" : ""}`}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Message 3 — user */}
                {demoStep >= 4 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                    <div className="bg-agri-600 text-white px-4 py-2.5 rounded-[18px] rounded-br-[4px] text-sm max-w-[80%] shadow-md shadow-agri-600/15">
                      {DEMO_SCRIPT[2].text}
                    </div>
                  </motion.div>
                )}

                {/* Typing after msg 3 */}
                {demoStep === 5 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 rounded-full bg-agri-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-agri-100 dark:border-agri-900/40 px-4 py-3 rounded-[18px] rounded-bl-[4px]">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((d) => (
                          <motion.div key={d} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: d }} className="w-1.5 h-1.5 rounded-full bg-agri-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Message 4 — AI */}
                {demoStep >= 6 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 rounded-full bg-agri-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-agri-100 dark:border-agri-900/40 px-4 py-3 rounded-[18px] rounded-bl-[4px] text-sm max-w-[88%] shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-agri-600 dark:text-agri-400 mb-2 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Pro
                      </p>
                      {(DEMO_SCRIPT[3] as { lines: string[] }).lines.map((line, i) => (
                        <p key={i} className={`text-gray-700 dark:text-gray-200 leading-relaxed ${line === "" ? "mt-1" : ""}`}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* CTA footer — appears when demo finishes */}
              <AnimatePresence>
                {demoStep >= 7 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-gray-100 dark:border-gray-800 bg-gradient-to-r from-agri-50 to-emerald-50 dark:from-agri-950/40 dark:to-emerald-950/30 px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Looks helpful?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Try it with your own farm, free.</p>
                    </div>
                    <button
                      onClick={() => { window.location.href = "/signup" }}
                      className="flex-shrink-0 px-5 py-2.5 bg-agri-600 hover:bg-agri-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      Start Free <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}