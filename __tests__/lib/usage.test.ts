/**
 * @jest-environment jsdom
 */
import { getUsage, incrementUsage, formatResetTime, canSendWithCost } from "@/lib/usage"

const FREE_KEY = "agriintel_usage_free"
const PRO_KEY = "agriintel_usage_pro"

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ─── formatResetTime ─────────────────────────────────────────────────────────

describe("formatResetTime", () => {
  it("shows minutes when under 60", () => {
    expect(formatResetTime(30)).toBe("30m")
    expect(formatResetTime(1)).toBe("1m")
    expect(formatResetTime(59)).toBe("59m")
  })

  it("shows hours when exactly on the hour", () => {
    expect(formatResetTime(60)).toBe("1h")
    expect(formatResetTime(120)).toBe("2h")
  })

  it("shows hours and minutes for mixed values", () => {
    expect(formatResetTime(90)).toBe("1h 30m")
    expect(formatResetTime(125)).toBe("2h 5m")
  })
})

// ─── getUsage ────────────────────────────────────────────────────────────────

describe("getUsage — no prior data", () => {
  it("returns 0 count and canSend=true when nothing stored", () => {
    const info = getUsage("free")
    expect(info.count).toBe(0)
    expect(info.canSend).toBe(true)
    expect(info.limit).toBe(20)
    expect(info.percentage).toBe(0)
  })

  it("uses correct limit for pro/fasal", () => {
    const info = getUsage("pro", "fasal")
    expect(info.limit).toBe(200)
  })

  it("uses correct limit for pro/vriddhi", () => {
    const info = getUsage("pro", "vriddhi")
    expect(info.limit).toBe(60)
  })
})

describe("getUsage — with stored data", () => {
  it("reads count from localStorage", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 5, windowStart: Date.now() }))
    const info = getUsage("free")
    expect(info.count).toBe(5)
    expect(info.canSend).toBe(true)
    expect(info.percentage).toBeCloseTo(25) // 5/20 = 25%
  })

  it("canSend is false when at limit", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 20, windowStart: Date.now() }))
    const info = getUsage("free")
    expect(info.canSend).toBe(false)
    expect(info.percentage).toBe(100)
  })

  it("resets when window has expired", () => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000 - 1
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 15, windowStart: sixHoursAgo }))
    const info = getUsage("free")
    expect(info.count).toBe(0)
    expect(info.canSend).toBe(true)
  })

  it("does not reset when window is still valid", () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 10, windowStart: oneHourAgo }))
    const info = getUsage("free")
    expect(info.count).toBe(10)
  })
})

// ─── incrementUsage ──────────────────────────────────────────────────────────

describe("incrementUsage", () => {
  it("sets count to 1 on first call", () => {
    incrementUsage("free")
    const raw = JSON.parse(localStorage.getItem(FREE_KEY)!)
    expect(raw.count).toBe(1)
  })

  it("increments existing count", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 5, windowStart: Date.now() }))
    incrementUsage("free")
    const raw = JSON.parse(localStorage.getItem(FREE_KEY)!)
    expect(raw.count).toBe(6)
  })

  it("respects cost parameter", () => {
    incrementUsage("free", undefined, 2)
    const raw = JSON.parse(localStorage.getItem(FREE_KEY)!)
    expect(raw.count).toBe(2)
  })

  it("resets window and sets count=cost when window expired", () => {
    const expired = Date.now() - 7 * 60 * 60 * 1000
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 18, windowStart: expired }))
    incrementUsage("free", undefined, 2)
    const raw = JSON.parse(localStorage.getItem(FREE_KEY)!)
    expect(raw.count).toBe(2)
  })

  it("uses separate keys for free and pro", () => {
    incrementUsage("free")
    incrementUsage("pro", "fasal")
    const freeRaw = JSON.parse(localStorage.getItem(FREE_KEY)!)
    const proRaw = JSON.parse(localStorage.getItem(PRO_KEY)!)
    expect(freeRaw.count).toBe(1)
    expect(proRaw.count).toBe(1)
  })
})

// ─── canSendWithCost (legacy) ────────────────────────────────────────────────

describe("canSendWithCost", () => {
  it("returns true when count + cost is within limit", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 18, windowStart: Date.now() }))
    expect(canSendWithCost("free", undefined, 1)).toBe(true)
  })

  it("returns false when cost would exceed limit", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 19, windowStart: Date.now() }))
    expect(canSendWithCost("free", undefined, 2)).toBe(false)
  })

  it("returns true when at exactly the limit minus cost", () => {
    localStorage.setItem(FREE_KEY, JSON.stringify({ count: 18, windowStart: Date.now() }))
    expect(canSendWithCost("free", undefined, 2)).toBe(true)
  })
})
