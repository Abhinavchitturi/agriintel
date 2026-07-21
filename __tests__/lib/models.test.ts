import { getModelById, FREE_MODEL, PRO_MODELS } from "@/lib/models"

describe("getModelById", () => {
  it("returns FREE_MODEL for 'kisan'", () => {
    expect(getModelById("kisan")).toBe(FREE_MODEL)
  })

  it("returns the fasal pro model", () => {
    const m = getModelById("fasal")
    expect(m.id).toBe("fasal")
    expect(m.groqId).toBe("llama-3.3-70b-versatile")
    expect(m.requestLimit).toBe(200)
    expect(m.resetHours).toBe(3)
  })

  it("returns the vriddhi model", () => {
    const m = getModelById("vriddhi")
    expect(m.id).toBe("vriddhi")
    expect(m.groqId).toBe("deepseek-r1-distill-llama-70b")
  })

  it("returns the samriddhi model", () => {
    const m = getModelById("samriddhi")
    expect(m.id).toBe("samriddhi")
    expect(m.requestLimit).toBe(30)
  })

  it("falls back to first pro model for unknown id", () => {
    expect(getModelById("nonexistent")).toBe(PRO_MODELS[0])
  })

  it("free model has correct limits", () => {
    expect(FREE_MODEL.requestLimit).toBe(20)
    expect(FREE_MODEL.resetHours).toBe(6)
  })

  it("all pro models have positive requestLimit and resetHours", () => {
    PRO_MODELS.forEach((m) => {
      expect(m.requestLimit).toBeGreaterThan(0)
      expect(m.resetHours).toBeGreaterThan(0)
    })
  })
})
