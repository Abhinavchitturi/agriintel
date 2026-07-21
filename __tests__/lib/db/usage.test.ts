import { canSendWithCost } from "@/lib/db/usage"
import type { UsageInfo } from "@/lib/db/usage"

function makeInfo(count: number, limit: number): UsageInfo {
  const pct = Math.min(100, (count / limit) * 100)
  return { count, limit, resetInMinutes: 60, canSend: count < limit, percentage: pct }
}

describe("canSendWithCost (db/usage)", () => {
  it("returns true when count + cost is within limit", () => {
    expect(canSendWithCost(makeInfo(5, 20), 1)).toBe(true)
  })

  it("returns false when count + cost exceeds limit", () => {
    expect(canSendWithCost(makeInfo(19, 20), 2)).toBe(false)
  })

  it("returns true when count + cost equals limit exactly", () => {
    expect(canSendWithCost(makeInfo(18, 20), 2)).toBe(true)
  })

  it("returns false when already at limit", () => {
    expect(canSendWithCost(makeInfo(20, 20), 1)).toBe(false)
  })

  it("returns false when count is 0 but limit is also 0", () => {
    expect(canSendWithCost(makeInfo(0, 0), 1)).toBe(false)
  })

  it("handles translation cost of 2 correctly", () => {
    // 1 request left — can't afford 2
    expect(canSendWithCost(makeInfo(19, 20), 2)).toBe(false)
    // 2 requests left — can afford 2
    expect(canSendWithCost(makeInfo(18, 20), 2)).toBe(true)
  })
})
