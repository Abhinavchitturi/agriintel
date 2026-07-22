"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CreditCard, Lock, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { upgradePlan, getCurrentProfile } from "@/lib/db/auth"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId?: string
}

function detectCardType(num: string): { type: string; color: string } | null {
  const n = num.replace(/\s/g, "")
  if (/^4/.test(n)) return { type: "Visa", color: "from-blue-600 to-blue-800" }
  if (/^(5[1-5]|2[2-7])/.test(n)) return { type: "Mastercard", color: "from-red-500 to-orange-500" }
  if (/^(6[05]|81|82|508|353|356)/.test(n)) return { type: "RuPay", color: "from-green-600 to-emerald-700" }
  if (/^3[47]/.test(n)) return { type: "Amex", color: "from-gray-600 to-gray-800" }
  return null
}

function luhnCheck(num: string): boolean {
  const cleaned = num.replace(/\s/g, "")
  if (cleaned.length < 13) return false
  let sum = 0
  let isEven = false
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10)
    if (isNaN(digit)) return false
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    isEven = !isEven
  }
  return sum % 10 === 0
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

export default function PaymentModal({ isOpen, onClose, onSuccess, userId }: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [cardName, setCardName] = useState("")
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  const cardInfo = detectCardType(cardNumber)

  useEffect(() => {
    if (!isOpen) {
      setCardNumber("")
      setExpiry("")
      setCvv("")
      setCardName("")
      setError("")
      setIsProcessing(false)
      setSuccess(false)
    }
  }, [isOpen])

  const handlePay = async () => {
    setError("")

    if (!cardName.trim()) {
      setError("Please enter the name on your card")
      return
    }

    const rawCard = cardNumber.replace(/\s/g, "")
    if (rawCard.length < 13 || !luhnCheck(cardNumber)) {
      setError("Invalid card number")
      return
    }

    if (!cardInfo) {
      setError("Unrecognized card type. We accept Visa, Mastercard, RuPay, and Amex.")
      return
    }

    const [mm, yy] = expiry.split("/")
    const expMonth = parseInt(mm, 10)
    const expYear = 2000 + parseInt(yy || "0", 10)
    const now = new Date()
    if (!mm || !yy || expMonth < 1 || expMonth > 12 || expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      setError("Invalid or expired card date")
      return
    }

    if (cvv.length < 3) {
      setError("Invalid CVV")
      return
    }

    setIsProcessing(true)
    await new Promise((r) => setTimeout(r, 1800))

    // Upgrade in Supabase — use passed userId or look up current session
    const uid = userId ?? (await getCurrentProfile())?.id
    if (uid) await upgradePlan(uid, "pro")

    setIsProcessing(false)
    setSuccess(true)
    await new Promise((r) => setTimeout(r, 1500))
    onSuccess()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
            onClick={!isProcessing ? onClose : undefined}
          >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">
                    Upgrade to Pro
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">₹299 / month · Cancel anytime</p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-6">
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Welcome to Pro!
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Your account has been upgraded. Redirecting…
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Card preview strip */}
                    <div className={`h-10 rounded-lg flex items-center px-4 gap-3 transition-all ${cardInfo ? `bg-gradient-to-r ${cardInfo.color}` : "bg-gray-100 dark:bg-gray-800"}`}>
                      <CreditCard className={`w-5 h-5 ${cardInfo ? "text-white" : "text-gray-400"}`} />
                      <span className={`text-sm font-semibold ${cardInfo ? "text-white" : "text-gray-400"}`}>
                        {cardInfo ? cardInfo.type : "Enter card number to detect type"}
                      </span>
                    </div>

                    {/* Card Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Card Number
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Name on Card
                      </label>
                      <Input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="As it appears on card"
                        autoComplete="cc-name"
                      />
                    </div>

                    {/* Expiry + CVV */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Expiry
                        </label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={expiry}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          CVV
                        </label>
                        <Input
                          type="password"
                          inputMode="numeric"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder={cardInfo?.type === "Amex" ? "0000" : "000"}
                          maxLength={4}
                        />
                      </div>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </motion.div>
                    )}

                    <Button
                      className="w-full bg-gradient-to-r from-agri-600 to-agri-700 hover:from-agri-700 hover:to-agri-800"
                      size="lg"
                      onClick={handlePay}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          />
                          Processing…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Pay ₹299 / month
                        </span>
                      )}
                    </Button>

                    <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                      <Lock className="inline w-3 h-3 mr-1" />
                      Secure payment · GST extra · Cancel anytime
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
