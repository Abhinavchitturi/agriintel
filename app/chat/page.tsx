"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Bot, User as UserIcon, Sparkles, Zap, Leaf, CloudSun, Shield,
  Layers, Menu, X, Sun, Moon, Copy, Check, Globe, ChevronDown,
  LogOut, MessageSquarePlus, AlertTriangle, RefreshCw, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getCurrentProfile, dbSignOut } from "@/lib/db/auth"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/lib/supabase"
import { getUsageFromDb, incrementUsageInDb, canSendWithCost, type UsageInfo } from "@/lib/db/usage"
import { formatResetTime } from "@/lib/usage"
import { FREE_MODEL, PRO_MODELS, getModelById, type AgriModel } from "@/lib/models"
import PaymentModal from "@/components/PaymentModal"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  metadata?: {
    confidence?: number
    generation_time?: number
    weather_data?: unknown
    processing_mode?: string
  }
}

const SUGGESTIONS = [
  "What crops grow best in Karnataka right now?",
  "How do I manage aphid infestation on cotton organically?",
  "Best fertilizer schedule for tomatoes?",
  "Will it rain in Maharashtra in the next week?",
  "How to improve soil pH for blueberry cultivation?",
  "What's the optimal planting window for wheat in Punjab?",
]

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸", proOnly: false },
  { code: "hi", name: "हिंदी", flag: "🇮🇳", proOnly: false },
  { code: "te", name: "తెలుగు", flag: "🇮🇳", proOnly: true },
  { code: "ta", name: "தமிழ்", flag: "🇮🇳", proOnly: true },
  { code: "kn", name: "ಕನ್ನಡ", flag: "🇮🇳", proOnly: true },
  { code: "mr", name: "मराठी", flag: "🇮🇳", proOnly: true },
  { code: "pa", name: "ਪੰਜਾਬੀ", flag: "🇮🇳", proOnly: true },
  { code: "or", name: "ଓଡ଼ିଆ", flag: "🇮🇳", proOnly: true },
]

function extractLocationFromText(text: string): string | undefined {
  // No /i flag — requires the captured location to start with a capital letter (real place names)
  // so "for blueberry" or "for the next 2 weeks" don't accidentally match as locations
  const match = text.match(
    /\b(?:in|at|for|near|around)\s+([A-Z][a-zA-Z\s]{2,30}?)(?:\?|,|$|\s+(?:for|and|with|during|about))/
  )
  return match ? match[1].trim() : undefined
}

function isAskingForLocation(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes("which state") ||
    lower.includes("which district") ||
    lower.includes("which location") ||
    lower.includes("where are you") ||
    lower.includes("your location") ||
    lower.includes("your state") ||
    (lower.includes("farming in") && lower.endsWith("?")) ||
    (lower.includes("location") && lower.endsWith("?")) ||
    (lower.includes("state or district") && lower.endsWith("?"))
  )
}

function UsageBar({ usage, plan }: { usage: UsageInfo; plan: "free" | "pro" }) {
  const color =
    usage.percentage >= 90
      ? "bg-red-500"
      : usage.percentage >= 70
      ? "bg-yellow-500"
      : "bg-agri-500"

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${usage.percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="shrink-0 tabular-nums">
        {usage.count}/{usage.limit} requests
        {" · "}
        resets in {formatResetTime(usage.resetInMinutes)}
      </span>
    </div>
  )
}

function CopiedCheck() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <Check className="w-4 h-4 text-agri-500" />
    </motion.span>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string>("fasal")
  const [darkMode, setDarkMode] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [chatSessions, setChatSessions] = useState<{ id: string; preview: string; timestamp: Date; messages: Message[] }[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>(Date.now().toString())
  const [authChecked, setAuthChecked] = useState(false)
  const [freeMessageCount, setFreeMessageCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  // Auth check
  useEffect(() => {
    getCurrentProfile().then(async (profile) => {
      if (!profile) { router.replace("/login"); return }
      setUser(profile)
      setAuthChecked(true)

      // Reset language to 'en' if free user somehow has a Pro-only language saved
      const savedLang = localStorage.getItem("agriintel_language") ?? "en"
      const proOnlyCodes = ["te", "ta", "kn", "mr", "pa", "or"]
      const safeLang = profile.plan !== "pro" && proOnlyCodes.includes(savedLang) ? "en" : savedLang
      setSelectedLanguage(safeLang)

      const savedModel = localStorage.getItem("agriintel_selected_model") ?? "fasal"
      setSelectedModelId(savedModel)
      const usageInfo = await getUsageFromDb(profile.id, profile.plan, profile.plan === "pro" ? savedModel : undefined)
      setUsage(usageInfo)

      const saved = localStorage.getItem("theme")
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const isDark = saved ? saved === "dark" : prefersDark
      setDarkMode(isDark)
      document.documentElement.classList.toggle("dark", isDark)

      // Restore chat sessions from localStorage
      try {
        const savedSessions = localStorage.getItem("agriintel_chat_sessions")
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions)
          setChatSessions(parsed.map((s: { id: string; preview: string; timestamp: string; messages: Message[] }) => ({
            ...s,
            timestamp: new Date(s.timestamp),
            messages: s.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })),
          })))
        }
      } catch {}
    })
  }, [router])

  const refreshUsage = useCallback(async () => {
    if (user) {
      const info = await getUsageFromDb(user.id, user.plan, user.plan === "pro" ? selectedModelId : undefined)
      setUsage(info)
    }
  }, [user, selectedModelId])

  const handleModelSelect = async (modelId: string) => {
    setSelectedModelId(modelId)
    localStorage.setItem("agriintel_selected_model", modelId)
    if (user) {
      const info = await getUsageFromDb(user.id, user.plan, modelId)
      setUsage(info)
    }
    setShowModelMenu(false)
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false)
      }
    }
    if (showModelMenu) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showModelMenu])

  const toggleDarkMode = () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    localStorage.setItem("theme", newDark ? "dark" : "light")
    document.documentElement.classList.toggle("dark", newDark)
  }

  const handleSignOut = async () => {
    await dbSignOut()
    router.replace("/login")
  }

  const handlePaymentSuccess = async () => {
    setShowPayment(false)
    const updated = await getCurrentProfile()
    if (updated) {
      setUser(updated)
      const info = await getUsageFromDb(updated.id, updated.plan, updated.plan === "pro" ? selectedModelId : undefined)
      setUsage(info)
    }
  }

  const saveSessions = useCallback((sessions: typeof chatSessions) => {
    try {
      localStorage.setItem("agriintel_chat_sessions", JSON.stringify(sessions.slice(0, 20)))
    } catch {}
  }, [])

  const startNewChat = () => {
    if (messages.length > 0) {
      const session = {
        id: currentSessionId,
        preview: messages[0]?.content?.slice(0, 50) || "Chat",
        timestamp: messages[0]?.timestamp || new Date(),
        messages,
      }
      const updated = [session, ...chatSessions.filter((s) => s.id !== currentSessionId)].slice(0, 20)
      setChatSessions(updated)
      saveSessions(updated)
    }
    setMessages([])
    setCurrentSessionId(Date.now().toString())
    setFreeMessageCount(0)
    setShowSidebar(false)
  }

  const loadSession = (session: typeof chatSessions[0]) => {
    if (messages.length > 0) {
      const current = {
        id: currentSessionId,
        preview: messages[0]?.content?.slice(0, 50) || "Chat",
        timestamp: messages[0]?.timestamp || new Date(),
        messages,
      }
      const updated = [current, ...chatSessions.filter((s) => s.id !== currentSessionId && s.id !== session.id)].slice(0, 20)
      setChatSessions(updated)
      saveSessions(updated)
    }
    setMessages(session.messages)
    setCurrentSessionId(session.id)
    setFreeMessageCount(0)
    setShowSidebar(false)
  }

  const retryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUserMsg) return
    setMessages((prev) => prev.filter((m) => m.id !== prev[prev.length - 1]?.id))
    sendMessage(lastUserMsg.content)
  }

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Core send logic — accepts message text directly to avoid stale closure on input state
  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading || !user) return

      // Translation costs 2 requests (extra compute for language conversion)
      const requestCost = selectedLanguage !== "en" ? 2 : 1

      const wouldExceed = usage ? !canSendWithCost(usage, requestCost) : false
      if (usage && (!usage.canSend || wouldExceed)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `limit-${Date.now()}`,
            role: "assistant",
            content: `⚠️ You've reached your request limit for this window. Your limit resets in **${formatResetTime(usage.resetInMinutes)}**. ${user.plan === "free" ? "Upgrade to Pro for a higher allowance and faster resets." : ""}`,
            timestamp: new Date(),
          },
        ])
        return
      }

      // Build conversation history from current messages (before adding the new one)
      const conversationHistory = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Detect location from current message OR from conversation history
      let detectedLocation = extractLocationFromText(messageText)

      // If the last bot message asked for location and the user's reply looks like a
      // standalone location name (short, only letters/spaces/commas), treat it as the location
      let isLocationAnswer = false
      if (!detectedLocation) {
        const lastBotMsg = [...messages].reverse().find((m) => m.role === "assistant")
        if (lastBotMsg && isAskingForLocation(lastBotMsg.content)) {
          const trimmed = messageText.trim()
          if (trimmed.length <= 60 && /^[A-Za-z\s,]+$/.test(trimmed)) {
            detectedLocation = trimmed
            isLocationAnswer = true
          }
        }
      }

      // Fall back to a location mentioned anywhere earlier in the conversation
      if (!detectedLocation) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const loc = extractLocationFromText(messages[i].content)
          if (loc) {
            detectedLocation = loc
            break
          }
        }
      }

      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: messageText,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        // When user is answering a location follow-up (e.g. just typed "Hyderabad"),
        // reconstruct the real query so the LLM knows to: give current weather for
        // that location, evaluate any crops discussed in conversation for suitability
        // there, and suggest alternatives if those crops don't suit the climate.
        let effectiveQuery = messageText
        if (isLocationAnswer && detectedLocation) {
          const originalQuestion = [...conversationHistory].reverse().find((m) => m.role === "user")?.content
          if (originalQuestion) {
            effectiveQuery = `${originalQuestion} in ${detectedLocation}. Based on the weather and local climate, also assess whether any crops we discussed are suitable here and suggest better alternatives if not.`
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: effectiveQuery,
            language: selectedLanguage,
            location: detectedLocation,
            plan: user.plan,
            model_id: user.plan === "pro" ? selectedModelId : undefined,
            user_token: session?.access_token ?? null,
            conversation_history: conversationHistory,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.answer) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: "I couldn't generate a response. Please try again later.",
              timestamp: new Date(),
            },
          ])
          // Don't count failed responses against the user's request quota
          return
        }

        const assistantMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
          metadata: {
            confidence: data.confidence,
            generation_time: data.generation_time,
            weather_data: data.weather_data,
            processing_mode: data.processing_mode,
          },
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Don't count clarifying questions (e.g. "Which state are you in?") as requests.
        // A clarifying question is short and ends with a question mark.
        const isClarifyingQuestion =
          data.answer.trim().endsWith("?") && data.answer.trim().length < 200
        if (!isClarifyingQuestion) {
          incrementUsageInDb(user.id, user.plan, user.plan === "pro" ? selectedModelId : undefined, requestCost)
          refreshUsage()
          if (user.plan === "free") setFreeMessageCount((c) => c + 1)
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "Connection error. Please check your internet and try again.",
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, user, usage, messages, selectedLanguage, refreshUsage]
  )

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput("")
    await sendMessage(text)
  }

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  if (!authChecked) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-agri-200 border-t-agri-600 rounded-full"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    </div>
  )
  if (!user) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl transition-colors">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {showSidebar ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-agri-500 to-agri-700 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-gray-900 dark:text-white hidden sm:block">
                AgriIntel
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>{LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "English"}</span>
                {selectedLanguage !== "en" && (
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded">×2</span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showLanguageMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg py-2 z-50"
                >
                  {LANGUAGES.map((lang) => {
                    const locked = lang.proOnly && user.plan !== "pro"
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          if (locked) { setShowLanguageMenu(false); setShowPayment(true); return }
                          setSelectedLanguage(lang.code)
                          localStorage.setItem("agriintel_language", lang.code)
                          setShowLanguageMenu(false)
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                          locked
                            ? "opacity-50 cursor-default"
                            : selectedLanguage === lang.code
                            ? "bg-agri-50 dark:bg-agri-950/50 text-agri-700 dark:text-agri-300 font-medium"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <span>{lang.flag}</span>
                        <span className="flex-1">{lang.name}</span>
                        {locked ? (
                          <Lock className="w-3 h-3 text-gray-400" />
                        ) : lang.code !== "en" ? (
                          <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium">×2 req</span>
                        ) : null}
                      </button>
                    )
                  })}
                  <div className="mx-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Non-English costs 2 requests.
                    </p>
                    {user.plan !== "pro" && (
                      <p className="text-[10px] text-agri-600 dark:text-agri-400">
                        6 more languages available on Pro.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Plan badge */}
            <button
              onClick={() => user.plan === "free" && setShowPayment(true)}
              className={cn(
                "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                user.plan === "pro"
                  ? "bg-gradient-to-r from-agri-500 to-emerald-500 text-white shadow-md cursor-default"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-agri-50 dark:hover:bg-agri-950/50 hover:text-agri-600"
              )}
            >
              {user.plan === "pro" ? (
                <><Sparkles className="w-3 h-3" /> Pro</>
              ) : (
                <><Zap className="w-3 h-3" /> Free · Upgrade</>
              )}
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={startNewChat}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="New chat"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-16 left-0 bottom-0 w-72 bg-white dark:bg-gray-950 border-r border-gray-200/50 dark:border-gray-800/50 z-50 flex flex-col"
            >
              {/* User info */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-agri-500 to-agri-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                  </div>
                </div>
                {user.plan === "free" && (
                  <button
                    onClick={() => { setShowPayment(true); setShowSidebar(false) }}
                    className="mt-3 w-full py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-agri-600 to-agri-700 text-white hover:from-agri-700 hover:to-agri-800 transition-all"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>

              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Chat History
                </span>
                <button
                  onClick={startNewChat}
                  className="text-xs text-agri-600 dark:text-agri-400 hover:underline font-medium"
                >
                  + New
                </button>
              </div>

              <ScrollArea className="flex-1 px-3">
                <div className="space-y-1 pb-4">
                  {/* Current chat */}
                  {messages.length > 0 && (
                    <div className="px-3 py-2.5 rounded-xl bg-agri-50 dark:bg-agri-950/30 border border-agri-200 dark:border-agri-800">
                      <div className="text-xs font-medium text-agri-700 dark:text-agri-300 mb-0.5">
                        Current chat
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {messages[0]?.content?.slice(0, 45)}…
                      </div>
                    </div>
                  )}
                  {/* Past sessions */}
                  {chatSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <div className="text-xs truncate">{session.preview}</div>
                      <div className="text-xs opacity-60 mt-0.5">
                        {session.timestamp.toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                  {chatSessions.length === 0 && messages.length === 0 && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-6">
                      No history yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col pt-16">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto w-full px-4 py-6 space-y-6 pb-32">
              {/* Welcome */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-10"
                >
                  <div className="w-14 h-14 rounded-full bg-agri-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-agri-600/20">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Hi, {user.name.split(" ")[0]}!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto text-sm">
                    Ask me anything about farming, crops, weather, soil, or pests.
                    {user.plan === "free"
                      ? " Upgrade to Pro for detailed schedules and RAG-enhanced answers."
                      : " You have full Pro access with RAG-enhanced answers."}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => handleSuggestionClick(s)}
                        className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:border-agri-300 dark:hover:border-agri-700 hover:bg-agri-50 dark:hover:bg-agri-950/50 transition-all text-left"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Messages */}
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
                  >
                    <Avatar className="shrink-0 mt-1">
                      <AvatarFallback>
                        {message.role === "assistant" ? (
                          <Bot className="w-5 h-5 text-agri-600 dark:text-agri-400" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className={cn("flex-1 min-w-0", message.role === "user" ? "text-right" : "")}>
                      {message.role === "assistant" && message.metadata?.processing_mode && (
                        <div className="mb-1.5 flex items-center gap-1">
                          {message.metadata.processing_mode === "free_basic" ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                              Free
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-agri-600 dark:text-agri-400 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> Pro
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "inline-block max-w-[85%] px-5 py-3.5 rounded-[20px]",
                          message.role === "user"
                            ? "bg-agri-600 text-white rounded-br-[4px] shadow-md shadow-agri-600/15"
                            : message.metadata?.processing_mode === "free_basic"
                              ? "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-bl-[4px]"
                              : "bg-white dark:bg-gray-900 border border-agri-100 dark:border-agri-900/50 rounded-bl-[4px] shadow-sm"
                        )}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className={cn(
                            "prose prose-sm dark:prose-invert max-w-none",
                            message.role === "user" ? "prose-invert" : ""
                          )}
                        >
                          {message.content}
                        </ReactMarkdown>

                        {/* Metadata */}
                        {message.metadata && message.role === "assistant" && (
                          <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-800/50 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {message.metadata.confidence && (
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {Math.round(message.metadata.confidence * 100)}% confidence
                              </span>
                            )}
                            {message.metadata.generation_time && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {message.metadata.generation_time < 1
                                  ? `${Math.round(message.metadata.generation_time * 1000)}ms`
                                  : `${message.metadata.generation_time.toFixed(1)}s`}
                              </span>
                            )}
                            {message.metadata.processing_mode && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-agri-50 dark:bg-agri-950/50 text-agri-700 dark:text-agri-300">
                                <Layers className="w-3 h-3" />
                                {message.metadata.processing_mode.replace(/_/g, " ")}
                              </span>
                            )}
                            {!!message.metadata.weather_data && (
                              <span className="flex items-center gap-1">
                                <CloudSun className="w-3 h-3" />
                                Weather included
                              </span>
                            )}
                          </div>
                        )}

                        {/* Pro teaser — only on 1st and every 3rd free response to reduce noise */}
                        {message.role === "assistant" &&
                          message.metadata?.processing_mode === "free_basic" &&
                          (() => {
                            const freeIdx = messages.filter((m) => m.role === "assistant" && m.metadata?.processing_mode === "free_basic").indexOf(message)
                            return freeIdx === 0 || freeIdx % 3 === 0
                          })() && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                                  Pro unlocks
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {["NPK schedules", "7-day forecast", "Pest alerts", "Stage plans", "RAG accuracy"].map((f) => (
                                    <span
                                      key={f}
                                      className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-agri-50 dark:bg-agri-950/50 text-agri-600 dark:text-agri-400 border border-agri-100 dark:border-agri-900/60"
                                    >
                                      <Sparkles className="w-2 h-2" />
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => setShowPayment(true)}
                                className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-700 text-white transition-colors whitespace-nowrap"
                              >
                                Try Pro →
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2 justify-end">
                          <span className="text-xs opacity-50">{formatTime(message.timestamp)}</span>
                          {message.role === "assistant" && message.id.startsWith("err-") && (
                            <button
                              onClick={retryLastMessage}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Retry"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {message.role === "assistant" && (
                            <button
                              onClick={() => copyMessage(message.id, message.content)}
                              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <AnimatePresence mode="wait">
                                {copiedId === message.id ? (
                                  <CopiedCheck key="check" />
                                ) : (
                                  <motion.span key="copy" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <Copy className="w-4 h-4" />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Loading dots */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <Avatar>
                    <AvatarFallback>
                      <Bot className="w-5 h-5 text-agri-600 dark:text-agri-400" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[20px] rounded-bl-[4px] p-4">
                    <div className="flex gap-1.5">
                      {[0, 0.15, 0.3].map((delay) => (
                        <motion.div
                          key={delay}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay }}
                          className="w-2 h-2 bg-agri-500 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-3">
            {usage && (
              <div className="mb-2">
                <UsageBar usage={usage} plan={user.plan} />
                {selectedLanguage !== "en" && (
                  <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1">
                    Non-English responses cost 2 requests due to translation.
                  </p>
                )}
              </div>
            )}

            {/* Upgrade nudge — only when 2 or fewer requests remain */}
            {usage && user.plan === "free" && usage.canSend && usage.limit - usage.count <= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 min-w-0">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">
                    {usage.limit - usage.count === 0
                      ? "No requests left — resets in " + usage.resetInMinutes + "m"
                      : `Only ${usage.limit - usage.count} request${usage.limit - usage.count !== 1 ? "s" : ""} left`}
                  </span>
                </div>
                <button
                  onClick={() => setShowPayment(true)}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                >
                  Upgrade to Pro
                </button>
              </motion.div>
            )}

            <form onSubmit={handleSend}>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus-within:border-agri-400 dark:focus-within:border-agri-600 transition-colors">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about crops, weather, soil, pests, farming techniques…"
                  className="w-full min-h-[52px] max-h-[180px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-4 pt-3.5 pb-1"
                  disabled={isLoading}
                  rows={1}
                />
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {user.plan === "pro" ? (
                      // Pro: clickable model selector
                      <div className="relative" ref={modelMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowModelMenu(!showModelMenu)}
                          className="flex items-center gap-1 font-medium text-agri-600 dark:text-agri-400 hover:text-agri-700 dark:hover:text-agri-300 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          {getModelById(selectedModelId).name}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <AnimatePresence>
                          {showModelMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              className="absolute bottom-full mb-2 left-0 w-72 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl py-2 z-50"
                            >
                              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Select Model
                              </p>
                              {PRO_MODELS.map((model) => (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => handleModelSelect(model.id)}
                                  className={cn(
                                    "w-full px-3 py-2.5 text-left flex items-start gap-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                                    selectedModelId === model.id && "bg-agri-50 dark:bg-agri-950/40"
                                  )}
                                >
                                  <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center border-agri-500">
                                    {selectedModelId === model.id && (
                                      <div className="w-2 h-2 rounded-full bg-agri-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                        {model.name}
                                      </span>
                                      <span className={cn("text-[10px] font-bold", model.badgeColor)}>
                                        {model.badge}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                      {model.tagline}
                                    </p>
                                    <p className="text-[10px] text-agri-600 dark:text-agri-400 mt-0.5 font-medium">
                                      {model.requestLimit} req · resets in {model.resetHours}h
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-agri-600 dark:text-agri-400">
                        <Zap className="w-3 h-3" /> {FREE_MODEL.name}
                      </span>
                    )}
                    {user.plan === "pro" && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-0.5">
                          <Layers className="w-3 h-3" /> RAG
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim() || isLoading || (usage ? !usage.canSend : false)}
                    className="h-8 w-8 p-0 rounded-lg bg-agri-600 hover:bg-agri-700 disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1.5 text-right hidden sm:block">
                Shift+Enter for new line
              </p>
            </form>
          </div>
        </div>
      </main>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
