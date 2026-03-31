# Flash-MoE Assessment for Sprint Co

## What Is Flash-MoE?

Flash-MoE is a **pure C/Metal inference engine** that runs a 397-billion-parameter Mixture-of-Experts model (Qwen3.5-397B-A17B) on a MacBook Pro with 48GB RAM at **4.4+ tokens/second** with production-quality output including tool calling.

### Key Details

**Model:** Qwen3.5-397B-A17B
- Architecture: Mixture-of-Experts (MoE)
- Parameters: 397 billion
- Quantization: 4-bit (production), 2-bit (experimental)
- Disk size: 209GB at 4-bit
- Layer structure: 60 layers (45 linear attention + 15 full attention)
- Experts per layer: 512 total, 4 active per token (plus 1 shared)
- Context window: 262,144 tokens (256K)

**Performance on M3 Max MacBook Pro:**
- Speed: 4.36 tokens/second (4-bit, FMA-optimized kernel)
- Memory: 48GB unified
- Hardware acceleration: Metal compute shaders, Accelerate BLAS

### Technical Innovation

Flash-MoE uses several cutting-edge techniques:

1. **SSD Expert Streaming** — 209GB model lives on disk, experts loaded on-demand
2. **FMA-Optimized Dequant Kernel** — 12% faster 4-bit matrix-vector multiplication
3. **Hand-Tuned Metal Kernels** — Custom GPU compute for dequant, activation, norm, attention, RoPE, MoE combine
4. **Deferred GPU Compute** — GPU executes expert forward pass while CPU prepares next layer
5. **Accelerate BLAS** — 64% faster linear attention via CBLAS operations

**Quality:** Excellent. 4-bit quantization maintains full JSON/tool-calling reliability. 2-bit variant (5.74 tok/s) breaks JSON output.

---

## Could Flash-MoE Be Used in Sprint Co?

### Constraints

| Factor | Assessment | Impact |
|--------|-----------|--------|
| **Hardware availability** | MacBook Pro M3 Max required | Dev/eval only, not cloud-scale |
| **Cloud deployment** | Not viable at inference time | Can't deploy to Paperclip cloud agents |
| **API integration** | Would require custom adapter | Paperclip expects OpenAI-compatible API or standard local runtime |
| **Token/second throughput** | 4.36 tok/s is slow for 6-hour sessions | ~15K tokens/hour vs. Opus 500K+/hour over same period |
| **Latency-sensitive tasks** | Medium: ~230ms per token | Fine for coding, painful for interactive feedback loops |
| **Cost** | Hardware only (~$3500 MacBook) | Cheaper than API but less scalable |

### Feasibility: **Low for production, Medium for research**

**Production:** Flash-MoE cannot replace Opus 4.6 because:
1. **Scalability:** Paperclip agents run in parallel. Scaling Flash-MoE requires multiple laptops and custom orchestration.
2. **API mismatch:** Paperclip expects standard adapters (Claude Code CLI, etc.). Flash-MoE is a custom binary.
3. **Throughput:** 4.36 tok/s × 3 hours = ~47K tokens max output. A 6-hour Opus run produces 200K+ tokens of richer output.
4. **Cost per sprint:** Flash-MoE = laptop hardware amortized + electricity. Opus = $120-200 per 6-hour run. For 1-2 sprints/day, Opus is cheaper.

**Research:** Flash-MoE is valuable for:
1. Offline capability testing (no API dependency)
2. Optimizing prompting locally before expensive cloud runs
3. Understanding inference efficiency limits
4. Running eval/critique pass locally while generator runs in cloud

### Recommendation: **Use Opus 4.6 for production, Flash-MoE for offline eval**

---

## Why We're Switching to Haiku for Now

While Flash-MoE is impressive, the Sprint Co harness specification prioritizes:

| Criterion | Opus 4.6 | Haiku | Flash-MoE |
|-----------|----------|-------|-----------|
| **Coherence on 3-4 hour tasks** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Long-context retrieval** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Code quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Cost per sprint** | $$$ ($150-200) | $ ($30-50) | $ (amortized) |
| **API availability** | ✓ Cloud native | ✓ Cloud native | ✗ Local only |
| **Parallel scaling** | ✓ Multi-agent | ✓ Multi-agent | ✗ Single machine |
| **Tool calling** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Cost-Speed Tradeoff

**Opus 4.6 (Recommended for Sprint Co):**
- Cost: $120-200 per 6-hour run
- Speed: 40-50 tok/s (estimate from API)
- Output quality: Museum-quality designs, working code, bug-free core
- Throughput per sprint: 200K+ tokens of substantive work
- **ROI:** Higher cost, but unmatched output quality and coherence

**Haiku (Cost-optimized alternative):**
- Cost: $30-50 per 6-hour run
- Speed: 20-25 tok/s (estimate)
- Output quality: Decent, but more hallucinations and bugs
- Throughput per sprint: 80K-120K tokens
- **ROI:** 4x cheaper, but ~30% quality degradation

**Flash-MoE (Research/offline only):**
- Cost: ~$1/sprint (electricity + amortized hardware)
- Speed: 4.36 tok/s (measured)
- Output quality: Good, but less refined than Opus
- Throughput per sprint: 47K tokens max
- Scalability: Single machine only
- **ROI:** Ultra-cheap, but cannot scale to production

### Strategic Choice

For **Sprint Co (production):** **Opus 4.6**
- Anthropic's proven harness research validates this choice
- Multi-agent pattern requires model capable of 3+ hour coherence
- Evaluator (QA agent) needs strong reasoning and skepticism
- Better to spend $150-200 for museum-quality than $30-50 for mediocre features

For **Research/optimization:** **Flash-MoE**
- Test prompt engineering offline before expensive cloud runs
- Understand inference efficiency edge cases
- Validate harness logic without API costs

For **Budget-constrained MVP:** **Haiku**
- If cost is critical, Haiku can work for smaller features
- Accept 30% quality reduction, add more iterations/evaluator cycles

---

## Integration Considerations

If Flash-MoE were to be used:

1. **Custom adapter for Paperclip:** Would need to write a `flash_moe_local` adapter similar to `claude_local`
2. **Heartbeat loop:** Agents running on Flash-MoE would have single-machine constraint (no parallel dispatch)
3. **Context resets:** Flash-MoE's 256K context is larger than Opus but still needs reset pattern for 6+ hour runs
4. **Evaluator challenge:** Running the evaluator (quality-critical) on slower model risks missing bugs

### Conclusion

Flash-MoE is **not recommended for Sprint Co production** because:
- Paperclip expects cloud-native, parallel-scalable agents
- The 4.36 tok/s throughput is 10x slower than API models
- Local-only limits team collaboration and audit trails
- Cost advantage disappears when amortizing over multiple sprints/day

However, Flash-MoE is **excellent for**:
- Offline prompt optimization and testing
- Understanding LLM inference under hardware constraints
- Academic research on MoE efficiency
- Personal projects requiring zero-API-cost inference

**For Sprint Co, use Opus 4.6 (primary) and optionally Haiku (cost-conscious variant). Keep Flash-MoE in the toolkit for research and optimization loops.**
