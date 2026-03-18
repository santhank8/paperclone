"""
General-purpose conversational agent.

A jack-of-all-trades agent capable of handling diverse tasks through conversation,
tool usage, agent routing, code execution, and multimodal processing.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from loguru import logger

from templates.base_specialized_agent import BaseSpecializedAgent

# Import utilities
try:
    from utils.rate_limiter import RateLimiter, RateLimitConfig
    RATE_LIMITER_AVAILABLE = True
except ImportError:
    RATE_LIMITER_AVAILABLE = False
    logger.debug("Rate limiter not available")

try:
    from utils.agent_discovery import (
        discover_all_agents,
        find_best_agent_for_task,
        route_to_agent,
        discover_aop_instances,
        discover_router_instances,
    )
    AGENT_DISCOVERY_AVAILABLE = True
except ImportError:
    AGENT_DISCOVERY_AVAILABLE = False
    logger.debug("Agent discovery not available")

try:
    # Tool discovery utilities available for future use
    from utils.tool_discovery import (
        get_global_registry,
        discover_and_register_tools,
        generate_tool_schemas,
    )
    TOOL_DISCOVERY_AVAILABLE = True
except ImportError:
    TOOL_DISCOVERY_AVAILABLE = False
    logger.debug("Tool discovery not available")

try:
    from ddgs import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    DDGS = None
    DDGS_AVAILABLE = False
    logger.debug("ddgs (DuckDuckGo search) not available")

# LiveFetch: keyless evidence retrieval (discovery + fetch + extract + score) for grounded responses
LIVEFETCH_AVAILABLE = False
LiveFetch = None
RIntent = None
EPacket = None
try:
    import sys
    from pathlib import Path
    _packages_dir = Path(__file__).resolve().parents[3]  # repo root (e.g. packages/ in monorepo, or API repo root when CR-CA is at CR-CA/)
    if _packages_dir.exists() and str(_packages_dir) not in sys.path:
        sys.path.insert(0, str(_packages_dir))
    from LiveFetch.main import LiveFetch as _LiveFetch, RIntent as _RIntent, EPacket as _EPacket
    LiveFetch = _LiveFetch
    RIntent = _RIntent
    EPacket = _EPacket
    LIVEFETCH_AVAILABLE = True
    logger.debug("LiveFetch available for web evidence")
except Exception as e:
    logger.debug("LiveFetch not available: %s", e)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    requests = None
    REQUESTS_AVAILABLE = False

try:
    from crca_core.models.spec import LockedSpec
    from crca_reasoning.tool_router import ToolRouter
    CRCA_CORE_AVAILABLE = True
except Exception:
    LockedSpec = None  # type: ignore[misc, assignment]
    ToolRouter = None  # type: ignore[misc, assignment]
    CRCA_CORE_AVAILABLE = False

# â”€â”€â”€ Market data (CRCA-Q style): CoinGecko, Solana DEX tokens only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
from datetime import datetime, timezone

_CG_BASE = "https://api.coingecko.com/api/v3"
_CG_RATE_LIMIT_PER_MINUTE = 15
_CG_LIST_CACHE_TTL_SEC = 3600
_coingecko_list_cache: Optional[List[Dict[str, Any]]] = None
_coingecko_list_cache_time: float = 0.0
_coingecko_id_by_symbol: Dict[str, str] = {}
_coingecko_request_timestamps: List[float] = []


def _coingecko_rate_limit() -> None:
    """In-memory rate limit for CoinGecko (free tier)."""
    now = time.monotonic()
    window = now - 60.0
    global _coingecko_request_timestamps
    _coingecko_request_timestamps = [t for t in _coingecko_request_timestamps if t > window]
    if len(_coingecko_request_timestamps) >= _CG_RATE_LIMIT_PER_MINUTE:
        raise RuntimeError("CoinGecko rate limit exceeded; try again in a minute.")
    _coingecko_request_timestamps.append(now)


def _coingecko_fetch_solana_pairs() -> List[Dict[str, Any]]:
    """Fetch coins/list with include_platform; filter to Solana only."""
    if not REQUESTS_AVAILABLE:
        return []
    _coingecko_rate_limit()
    pairs: List[Dict[str, Any]] = []
    id_by_sym: Dict[str, str] = {}
    try:
        r = requests.get(
            f"{_CG_BASE}/coins/list",
            params={"include_platform": "true"},
            timeout=30,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        for coin in data:
            if not isinstance(coin, dict):
                continue
            platforms = coin.get("platforms") or {}
            if not isinstance(platforms, dict) or "solana" not in platforms:
                continue
            cid = coin.get("id") or ""
            sym = (coin.get("symbol") or "").lower()
            name = coin.get("name") or cid
            if not cid or not sym:
                continue
            pairs.append({
                "symbol": f"{sym.upper()}/USD",
                "id": cid,
                "name": name,
                "category": "crypto",
            })
            id_by_sym[sym] = cid
            id_by_sym[cid.lower()] = cid
        global _coingecko_id_by_symbol
        _coingecko_id_by_symbol = id_by_sym
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning("CoinGecko list fetch failed: {}", e)
        return []
    return sorted(pairs, key=lambda p: (p["symbol"], p["id"]))


def _market_pairs_registry(query: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return Solana DEX pairs from CoinGecko (cached); optional filter by query."""
    global _coingecko_list_cache, _coingecko_list_cache_time
    now = time.monotonic()
    if _coingecko_list_cache is None or (now - _coingecko_list_cache_time) > _CG_LIST_CACHE_TTL_SEC:
        try:
            _coingecko_list_cache = _coingecko_fetch_solana_pairs()
            _coingecko_list_cache_time = now
        except RuntimeError:
            return _coingecko_list_cache or []
    pairs = _coingecko_list_cache or []
    if query and query.strip():
        q = query.strip().upper()
        pairs = [
            p for p in pairs
            if q in (p.get("symbol") or "").replace("/", "") or q in (p.get("name") or "").upper()
        ]
    return pairs


def _coingecko_resolve_symbol(symbol: str) -> Optional[str]:
    """Resolve symbol (e.g. SOL, solana) to CoinGecko coin id."""
    s = (symbol or "").strip().lower().replace("/", "").replace("usd", "").replace("usdt", "")
    if not s:
        return None
    if not _coingecko_id_by_symbol:
        _market_pairs_registry(None)
    return _coingecko_id_by_symbol.get(s)


def _market_bars_coingecko(coin_id: str, days: int = 7, limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch OHLC from CoinGecko for a coin id. Returns list of { t, o, h, l, c, v } (v=0)."""
    if not REQUESTS_AVAILABLE:
        return []
    _coingecko_rate_limit()
    bars: List[Dict[str, Any]] = []
    try:
        r = requests.get(
            f"{_CG_BASE}/coins/{coin_id}/ohlc",
            params={"vs_currency": "usd", "days": str(days)},
            timeout=15,
        )
        if r.status_code != 200:
            return []
        raw = r.json()
        for row in raw:
            if not isinstance(row, (list, tuple)) or len(row) < 5:
                continue
            ts_ms = int(row[0])
            t_iso = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            bars.append({
                "t": t_iso,
                "o": float(row[1]),
                "h": float(row[2]),
                "l": float(row[3]),
                "c": float(row[4]),
                "v": 0,
            })
        if limit < len(bars):
            bars = bars[-limit:]
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning("CoinGecko OHLC fetch failed for {}: {}", coin_id, e)
        return []
    return bars


_MARKET_TIMEFRAME_TO_DAYS: Dict[str, int] = {
    "1d": 1, "1D": 1, "7d": 7, "7D": 7, "14d": 14, "30d": 30, "30D": 30,
    "90d": 90, "180d": 180, "365d": 365,
    "15min": 1, "15Min": 1, "1min": 1, "1Min": 1, "5min": 1, "5Min": 1,
    "1h": 1, "1H": 1, "4h": 7, "4H": 7,
}

try:
    from utils.batch_processor import BatchProcessor
    BATCH_PROCESSOR_AVAILABLE = True
except ImportError:
    BATCH_PROCESSOR_AVAILABLE = False
    logger.debug("Batch processor not available")

try:
    from utils.conversation import Conversation
    CONVERSATION_AVAILABLE = True
except ImportError:
    CONVERSATION_AVAILABLE = False
    logger.debug("Conversation not available")

try:
    from utils.formatter import Formatter
    FORMATTER_AVAILABLE = True
except ImportError:
    FORMATTER_AVAILABLE = False
    logger.debug("Formatter not available")

# Import agent-specific modules
try:
    from branches.general_agent.personality import get_personality, Personality
    from branches.general_agent.utils.prompt_builder import PromptBuilder
    PERSONALITY_AVAILABLE = True
except ImportError:
    PERSONALITY_AVAILABLE = False
    logger.debug("Personality system not available")

try:
    from prompts.general_agent import DEFAULT_GENERAL_AGENT_PROMPT
except ImportError:
    DEFAULT_GENERAL_AGENT_PROMPT = "You are a general-purpose AI assistant."

# Image annotation imports (optional - graceful fallback if not available)
try:
    from image_annotation.annotation_engine import ImageAnnotationEngine
    IMAGE_ANNOTATION_AVAILABLE = True
except ImportError:
    IMAGE_ANNOTATION_AVAILABLE = False
    logger.debug("Image annotation engine not available")
except Exception as e:
    IMAGE_ANNOTATION_AVAILABLE = False
    logger.warning(f"Image annotation engine import failed: {e}")

# Global singleton for image annotation engine (lazy-loaded)
_image_annotation_engine: Optional[Any] = None

# Legacy CRCAAgent import is opt-in only (non-production drift path).
_ENABLE_LEGACY_CRCA_IMPORT = os.getenv("CRCA_ENABLE_LEGACY_AGENT_IMPORT", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
if _ENABLE_LEGACY_CRCA_IMPORT:
    try:
        from CRCA import CRCAAgent

        CRCA_AVAILABLE = True
    except ImportError:
        CRCA_AVAILABLE = False
        CRCAAgent = None
        logger.debug("CRCAAgent not available for causal reasoning integration")
else:
    CRCA_AVAILABLE = False
    CRCAAgent = None

# Try to import file operations
try:
    from tools.file_operations import IntelligentFileManager, FileOperationsRegistry
    FILE_OPERATIONS_AVAILABLE = True
except ImportError:
    FILE_OPERATIONS_AVAILABLE = False
    IntelligentFileManager = None
    FileOperationsRegistry = None
    logger.debug("File operations not available")


@dataclass
class GeneralAgentConfig:
    """Configuration for GeneralAgent.
    
    Attributes:
        personality: Personality name or Personality instance
        enable_agent_routing: Enable agent routing (default: auto)
        enable_code_execution: Enable code interpreter (default: True)
        enable_multimodal: Enable multimodal support (default: True)
        enable_streaming: Enable streaming (default: True)
        enable_persistence: Enable conversation persistence (default: True)
        enable_causal_reasoning: Enable causal reasoning tools (default: True)
        enable_causal_temporal_nudge: When True, nudge LLM to consider predict_artifact/p_event/nested_mc when task suggests future/probability/scenarios (default: True)
        enable_file_operations: Enable file operations tools (default: True)
        enable_web_search: Enable web search via DuckDuckGo for current events (default: True)
        enable_market_data: Enable CRCA-Q style market data tools (search pairs, OHLC bars) (default: True)
        persistence_path: Path for conversation storage
        rate_limit_rpm: Rate limit requests per minute
        rate_limit_rph: Rate limit requests per hour
        custom_prompt_additions: Extendable prompt additions
    """
    personality: Union[str, Any, None] = "neutral"  # Any to handle Personality type if available
    enable_agent_routing: Union[bool, str] = "auto"
    enable_code_execution: bool = True
    enable_multimodal: bool = True
    enable_streaming: bool = True
    enable_persistence: bool = True
    enable_causal_reasoning: bool = True
    enable_causal_temporal_nudge: bool = True
    enable_file_operations: bool = True
    enable_web_search: bool = True
    enable_market_data: bool = True
    persistence_path: Optional[str] = None
    rate_limit_rpm: int = 60
    rate_limit_rph: int = 1000
    custom_prompt_additions: List[str] = field(default_factory=list)
    
    @classmethod
    def auto(cls, **overrides) -> "GeneralAgentConfig":
        """Create config with smart auto-detection and defaults.
        
        Args:
            **overrides: Any config values to override
            
        Returns:
            GeneralAgentConfig with smart defaults
        """
        import os
        from pathlib import Path
        
        # Auto-detect persistence path
        persistence_path = overrides.get("persistence_path")
        if persistence_path is None:
            default_path = Path.home() / ".crca" / "conversations"
            default_path.mkdir(parents=True, exist_ok=True)
            persistence_path = str(default_path)
        
        # Auto-detect model from env or use default
        # (Model selection handled in GeneralAgent.__init__)
        
        # Create config with smart defaults
        config = cls(
            persistence_path=persistence_path,
            **{k: v for k, v in overrides.items() if k != "persistence_path"}
        )
        
        return config


class GeneralAgent(BaseSpecializedAgent):
    """
    Pure hardened CR-CA Agent - a production-ready general-purpose agent
    that embodies the full power of the CR-CA (Causal Reasoning with Counterfactual Analysis) framework.
    
    This is NOT a generic general-purpose agent. It is a specialized CR-CA agent
    whose specialization IS being useful across diverse domains while maintaining
    the core CR-CA philosophy: causal reasoning, counterfactual analysis, and
    structured decision-making.
    
    Core CR-CA Identity:
    - Causal reasoning first: Understands cause-and-effect relationships
    - Counterfactual thinking: Explores "what-if" scenarios systematically
    - Structured analysis: Uses causal graphs and variable extraction
    - Evidence-based decisions: Grounds recommendations in causal analysis
    - Multi-domain applicability: Applies CR-CA principles across all domains
    
    Hardened Production Features:
    - Robust error handling with retry and fallback mechanisms
    - Rate limiting and resource management
    - Conversation persistence and state management
    - Comprehensive logging and monitoring
    - Graceful degradation when dependencies unavailable
    - Async/sync operations with proper resource cleanup
    - Batch processing for efficiency
    
    Full CR-CA Codebase Integration:
    - Causal reasoning tools (extract_causal_variables, generate_causal_analysis)
    - Meta-reasoning (scenario-level informativeness analysis, task-level strategic planning)
    - Image annotation (full ImageAnnotationEngine with geometric analysis)
    - File operations (read/write/list with intelligent management)
    - Agent discovery and routing (AOP/router integration for specialized agents)
    - Tool discovery (dynamic tool registry and schema generation)
    - Multi-step reasoning (always enabled for complex causal chains)
    - Code execution (for data analysis and causal modeling)
    - Multimodal processing (images, text, structured data)
    
    Routing Strategy:
    - Can route to specialized CR-CA agents (CRCAAgent, CRCA-SD, CRCA-CG, CRCA-Q)
    - Route-first approach: Check for specialized agents before direct handling
    - Falls back to direct CR-CA tool usage when appropriate
    - Maintains CR-CA methodology even when routing
    
    This agent represents the "useful" specialization - applying CR-CA's
    causal reasoning and counterfactual analysis capabilities to any domain
    or task, making it the go-to agent when you need CR-CA power without
    domain-specific constraints.
    """
    
    def __init__(
        self,
        model_name: Optional[str] = None,
        personality: Optional[Union[str, Any]] = None,
        agent_name: Optional[str] = None,
        config: Optional[GeneralAgentConfig] = None,
        # Legacy parameters (for backwards compatibility)
        max_loops: Optional[Union[int, str]] = None,
        agent_description: Optional[str] = None,
        description: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        enable_agent_routing: Optional[Union[bool, str]] = None,
        enable_code_execution: Optional[bool] = None,
        enable_multimodal: Optional[bool] = None,
        enable_streaming: Optional[bool] = None,
        enable_persistence: Optional[bool] = None,
        enable_causal_reasoning: Optional[bool] = None,
        enable_file_operations: Optional[bool] = None,
        enable_web_search: Optional[bool] = None,
        enable_market_data: Optional[bool] = None,
        persistence_path: Optional[str] = None,
        rate_limit_rpm: Optional[int] = None,
        rate_limit_rph: Optional[int] = None,
        custom_prompt_additions: Optional[List[str]] = None,
        aop_instance: Optional[Any] = None,
        router_instance: Optional[Any] = None,
        **kwargs,
    ):
        """Initialize GeneralAgent with smart auto-configuration.
        
        Simple usage (recommended):
            agent = GeneralAgent()  # Uses all smart defaults
            agent = GeneralAgent(model_name="gpt-4o")  # Just change model
            agent = GeneralAgent(personality="friendly")  # Just change personality
        
        Advanced usage:
            agent = GeneralAgent(config=GeneralAgentConfig.auto(...))
        
        Args:
            model_name: LLM model (auto-detected from env or defaults to gpt-4o-mini)
            personality: Personality name (default: neutral)
            agent_name: Unique identifier (auto-generated if None)
            config: Pre-configured GeneralAgentConfig (uses auto() if None)
            **kwargs: Legacy parameters for backwards compatibility
        """
        # Must exist before any base class or callback runs (e.g. _domain_specific_setup in super().__init__)
        self._aop_instance = aop_instance
        self._router_instance = router_instance
        # Auto-detect model from environment or use default
        if model_name is None:
            import os
            model_name = os.getenv("CRCA_MODEL_NAME", "gpt-4o-mini")
        
        # Use provided config or create auto-config
        if config is None:
            # Merge legacy parameters into config overrides
            config_overrides = {}
            if personality is not None:
                config_overrides["personality"] = personality
            if enable_agent_routing is not None:
                config_overrides["enable_agent_routing"] = enable_agent_routing
            if enable_code_execution is not None:
                config_overrides["enable_code_execution"] = enable_code_execution
            if enable_multimodal is not None:
                config_overrides["enable_multimodal"] = enable_multimodal
            if enable_streaming is not None:
                config_overrides["enable_streaming"] = enable_streaming
            if enable_persistence is not None:
                config_overrides["enable_persistence"] = enable_persistence
            if enable_causal_reasoning is not None:
                config_overrides["enable_causal_reasoning"] = enable_causal_reasoning
            if enable_file_operations is not None:
                config_overrides["enable_file_operations"] = enable_file_operations
            if enable_web_search is not None:
                config_overrides["enable_web_search"] = enable_web_search
            if enable_market_data is not None:
                config_overrides["enable_market_data"] = enable_market_data
            if persistence_path is not None:
                config_overrides["persistence_path"] = persistence_path
            if rate_limit_rpm is not None:
                config_overrides["rate_limit_rpm"] = rate_limit_rpm
            if rate_limit_rph is not None:
                config_overrides["rate_limit_rph"] = rate_limit_rph
            if custom_prompt_additions is not None:
                config_overrides["custom_prompt_additions"] = custom_prompt_additions
            
            config = GeneralAgentConfig.auto(**config_overrides)
        
        # Store configuration
        self.config = config
        
        # Auto-generate agent name if not provided
        if agent_name is None:
            import uuid
            agent_name = f"crca-agent-{uuid.uuid4().hex[:8]}"
        
        # Set defaults for other parameters
        if max_loops is None:
            max_loops = 3
        if agent_description is None:
            agent_description = description or "Pure hardened CR-CA Agent - useful across all domains"
        if temperature is None:
            temperature = 0.4
        
        # Build system prompt with personality and extensions
        if system_prompt is None:
            system_prompt = self._build_system_prompt()
        
        # Enable meta-reasoning (planning) for strategic task approach
        # This allows the agent to reason about its reasoning process
        kwargs.setdefault("plan_enabled", True)
        kwargs.setdefault("planning", True)
        
        # Initialize base agent with auto-configured settings
        super().__init__(
            max_loops=max_loops,
            agent_name=agent_name,
            agent_description=agent_description,
            model_name=model_name,
            system_prompt=system_prompt,
            temperature=temperature,
            code_interpreter=self.config.enable_code_execution,
            multi_modal=self.config.enable_multimodal,
            streaming_on=self.config.enable_streaming,
            **kwargs,
        )
        
        logger.info(f"Initialized GeneralAgent: {agent_name} (model: {model_name}, personality: {self.config.personality})")
    
    @classmethod
    def create(
        cls,
        model_name: Optional[str] = None,
        personality: Optional[str] = None,
        **kwargs
    ) -> "GeneralAgent":
        """Factory method for easy agent creation.
        
        Simplest usage:
            agent = GeneralAgent.create()
            agent = GeneralAgent.create(model_name="gpt-4o")
            agent = GeneralAgent.create(personality="friendly")
        
        Args:
            model_name: LLM model name
            personality: Personality name
            **kwargs: Additional parameters
            
        Returns:
            Configured GeneralAgent instance
        """
        return cls(model_name=model_name, personality=personality, **kwargs)
    
    def _build_system_prompt(self) -> str:
        """Build system prompt with personality and extensions.
        
        Returns:
            Complete system prompt string
        """
        builder = PromptBuilder(DEFAULT_GENERAL_AGENT_PROMPT) if PERSONALITY_AVAILABLE else None
        
        if builder:
            # Add personality
            if self.config.personality:
                try:
                    if isinstance(self.config.personality, str):
                        personality = get_personality(self.config.personality) if PERSONALITY_AVAILABLE else None
                    else:
                        personality = self.config.personality
                    
                    if personality and hasattr(personality, "get_prompt_addition"):
                        builder.add_personality(personality.get_prompt_addition())
                except Exception as e:
                    logger.warning(f"Error adding personality: {e}")
            
            # Add custom additions
            for addition in self.config.custom_prompt_additions:
                builder.add_custom(addition)
            
            return builder.build()
        
        # Fallback if PromptBuilder not available
        prompt = DEFAULT_GENERAL_AGENT_PROMPT
        if self.config.custom_prompt_additions:
            prompt += "\n\n" + "\n".join(self.config.custom_prompt_additions)
        return prompt
    
    def _get_domain_schema(self) -> Optional[Dict[str, Any]]:
        """Return tool schemas for agent discovery and dynamic tools.
        
        Returns:
            Dictionary containing tool schemas or None
        """
        # BaseSpecializedAgent wraps the schema in a list, so we return None
        # and handle tools in _domain_specific_setup by setting tools_list_dictionary directly
        return None
    
    def _get_agent_discovery_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for agent discovery tools.
        
        Returns:
            List of tool schema dictionaries
        """
        schemas = []
        
        # discover_agents tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "discover_agents",
                "description": "Discover all available agents from AOP and router instances",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        })
        
        # route_to_agent tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "route_to_agent",
                "description": "Route a task to a specific agent",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_name": {
                            "type": "string",
                            "description": "Name of the agent to route to",
                        },
                        "task": {
                            "type": "string",
                            "description": "Task to execute",
                        },
                    },
                    "required": ["agent_name", "task"],
                },
            },
        })
        
        return schemas
    
    def _get_tool_discovery_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for tool discovery.
        
        Returns:
            List of tool schema dictionaries
        """
        schemas = []
        
        # discover_tools tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "discover_tools",
                "description": "Discover available tools dynamically",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        })
        
        return schemas
    
    def _get_web_search_schema(self) -> List[Dict[str, Any]]:
        """Get schema for web search tool (DuckDuckGo). Enables current events past training cutoff."""
        return [{
            "type": "function",
            "function": {
                "name": "web_search",
                "description": (
                    "Search the web for current information via DuckDuckGo. Use this when the user asks about "
                    "recent events, news, or anything after your knowledge cutoff (e.g. 2024). Returns titles, "
                    "snippets, and URLs. Call this to stay updated with real-world events."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (e.g. 'latest Fed interest rate 2025', 'recent news about X')",
                        },
                        "max_results": {
                            "type": "integer",
                            "default": 5,
                            "description": "Maximum number of results to return (1-10, default 5)",
                        },
                    },
                    "required": ["query"],
                },
            },
        }]

    def _get_market_data_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for CRCA-Q style market data: search pairs and OHLC bars (CoinGecko, Solana DEX)."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "market_search",
                    "description": (
                        "Search available trading pairs (Solana DEX tokens from CoinGecko). Use before get_market_ohlc "
                        "to get valid symbols (e.g. SOL/USD, RAY/USD). Returns symbol, id, name, and category."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Optional filter: symbol code (e.g. BTC, EUR) or part of name. Omit for full list.",
                            },
                        },
                        "required": [],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_market_ohlc",
                    "description": (
                        "Get OHLC (open, high, low, close, volume) bars for a Solana DEX pair from CoinGecko. "
                        "Use market_search to get valid symbols. Returns latest bars for charts and analysis."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "symbol": {
                                "type": "string",
                                "description": "Trading pair, e.g. BTC/USD, ETH/USD, EUR/USD, SOL/USD",
                            },
                            "timeframe": {
                                "type": "string",
                                "default": "15Min",
                                "description": "Candle interval: 1Min, 5Min, 15Min, 1H, 4H, 1D (FX uses daily regardless)",
                            },
                            "limit": {
                                "type": "integer",
                                "default": 100,
                                "description": "Number of bars to return (1-500)",
                            },
                        },
                        "required": ["symbol"],
                    },
                },
            },
        ]

    def _get_image_annotation_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for image annotation tools.
        
        Returns:
            List of tool schema dictionaries
        """
        schemas = []
        
        # annotate_image tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "annotate_image",
                "description": "Annotate an image with geometric primitives, semantic labels, and measurements. Automatically detects image type, tunes parameters, and extracts primitives (lines, circles, contours). Returns overlay image, formal report, and JSON data.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "image_path": {
                            "type": "string",
                            "description": "Path to image file, URL, or description of image location"
                        },
                        "output_format": {
                            "type": "string",
                            "enum": ["overlay", "json", "report", "all"],
                            "default": "all",
                            "description": "Output format: 'overlay' (numpy array), 'json' (structured data), 'report' (text), 'all' (AnnotationResult)"
                        },
                        "frame_id": {
                            "type": "integer",
                            "description": "Optional frame ID for temporal tracking in video sequences"
                        }
                    },
                    "required": ["image_path"]
                }
            }
        })
        
        # query_image tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "query_image",
                "description": "Answer a specific query about an image using natural language. Performs annotation first, then analyzes the results to answer questions like 'find the largest building', 'measure dimensions', 'count objects', etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "image_path": {
                            "type": "string",
                            "description": "Path to image file, URL, or description of image location"
                        },
                        "query": {
                            "type": "string",
                            "description": "Natural language query about the image (e.g., 'find the largest building and measure its dimensions', 'count how many circles are in the image', 'identify all lines and measure their lengths')"
                        },
                        "frame_id": {
                            "type": "integer",
                            "description": "Optional frame ID for temporal tracking"
                        }
                    },
                    "required": ["image_path", "query"]
                }
            }
        })
        
        return schemas
    
    def _get_causal_reasoning_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for structure/influence extraction and analysis (general-purpose, any domain).
        
        Returns:
            List of tool schema dictionaries
        """
        schemas = []
        
        # extract_causal_variables: general "factors + influence" extraction for any domain
        schemas.append({
            "type": "function",
            "function": {
                "name": "extract_causal_variables",
                "description": (
                    "Extract key factors and influence relationships from any domain (business, science, "
                    "policy, health, engineering, etc.). Build an influence graph: nodes = important factors/concepts, "
                    "edges = [source, target] meaning 'source influences target'. Use whenever you need to "
                    "structure a problem, identify drivers and outcomes, or prepare for what-if reasoning. "
                    "You can call with only required_variables first, then add edges in a follow-up call."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "required_variables": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Core factors, quantities, or concepts that matter for the problem (e.g. price, demand, policy, risk, health_status)"
                        },
                        "reasoning": {
                            "type": "string",
                            "description": "Brief explanation of why these factors and relationships are relevant to the user's question or task"
                        },
                        "causal_edges": {
                            "type": "array",
                            "items": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 2,
                                "maxItems": 2
                            },
                            "description": "Influence relationships: each [source, target] means 'source influences or drives target'. Omit or empty if you only want to list factors first."
                        },
                        "optional_variables": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Additional factors that may be relevant but not central"
                        },
                        "counterfactual_variables": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Factors you want to explore in what-if scenarios (e.g. levers, policy knobs, or key outcomes)"
                        },
                        "domain_context": {
                            "type": "string",
                            "description": "Optional tag for the domain (e.g. business, health, policy, engineering) to focus reasoning"
                        }
                    },
                    "required": ["required_variables", "reasoning"]
                }
            }
        })
        
        # generate_causal_analysis: structured analysis and what-if scenarios from the graph
        schemas.append({
            "type": "function",
            "function": {
                "name": "generate_causal_analysis",
                "description": (
                    "Produce structured analysis and what-if scenarios using the current influence graph. "
                    "Call after extract_causal_variables. Use for: explaining how factors connect, proposing "
                    "interventions or levers, comparing counterfactual scenarios, assessing confidence, "
                    "and giving a clear recommendation or next step. Works in any domain (business, policy, health, etc.)."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "causal_analysis": {
                            "type": "string",
                            "description": "Narrative analysis of how the key factors relate and what mechanisms or evidence you see"
                        },
                        "intervention_planning": {
                            "type": "string",
                            "description": "Concrete interventions or levers to test (e.g. change X, measure Y, policy Z)"
                        },
                        "counterfactual_scenarios": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "scenario_name": {"type": "string"},
                                    "interventions": {"type": "object"},
                                    "expected_outcomes": {"type": "object"},
                                    "reasoning": {"type": "string"}
                                }
                            },
                            "description": "Multiple what-if scenarios (each with interventions and expected outcomes)"
                        },
                        "causal_strength_assessment": {
                            "type": "string",
                            "description": "Assessment of which relationships are strong vs uncertain, and any confounders or gaps"
                        },
                        "optimal_solution": {
                            "type": "string",
                            "description": "Recommended direction, decision, or next step based on the analysis"
                        }
                    },
                    "required": [
                        "causal_analysis",
                        "intervention_planning",
                        "counterfactual_scenarios",
                        "causal_strength_assessment",
                        "optimal_solution"
                    ]
                }
            }
        })
        
        return schemas

    def _get_causal_core_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for crca_core tools: identify, estimate, counterfactual, design_intervention.

        These tools require a LockedSpec (set on agent as _crca_locked_spec by the session).
        Numeric outputs come only from these tools; the LLM must not invent counterfactual numbers.
        """
        if not CRCA_CORE_AVAILABLE:
            return []
        return [
            {
                "type": "function",
                "function": {
                    "name": "identify",
                    "description": (
                        "Identify the causal effect of treatment on outcome under the locked structural model. "
                        "Call this when the user asks whether an effect is identifiable or what adjustment is needed. "
                        "Requires a locked spec (session must have locked a causal spec)."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "treatment": {"type": "string", "description": "Treatment variable name."},
                            "outcome": {"type": "string", "description": "Outcome variable name."},
                        },
                        "required": ["treatment", "outcome"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "estimate",
                    "description": (
                        "Estimate the causal effect from data using the locked spec and identification. "
                        "Call when the user asks for a numeric effect estimate. Requires data and locked spec."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "treatment": {"type": "string", "description": "Treatment variable."},
                            "outcome": {"type": "string", "description": "Outcome variable."},
                            "data": {"type": "object", "description": "Dataset (e.g. DataFrame as dict/list) for estimation."},
                        },
                        "required": ["treatment", "outcome"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "counterfactual",
                    "description": (
                        "Compute a counterfactual under the locked SCM: given a factual observation and an intervention, "
                        "returns the counterfactual outcome. Use this for any what-if or do-intervention question. "
                        "Do NOT invent counterfactual numbers yourself; always call this tool."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "factual_observation": {
                                "type": "object",
                                "description": "Observed values for all endogenous variables (e.g. {\"X\": 1.0, \"Y\": 2.0}).",
                                "additionalProperties": {"type": "number"},
                            },
                            "intervention": {
                                "type": "object",
                                "description": "do-intervention: variable -> value (e.g. {\"X\": 0}).",
                                "additionalProperties": {"type": "number"},
                            },
                        },
                        "required": ["factual_observation", "intervention"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "design_intervention",
                    "description": (
                        "Design interventions to achieve a target query under the locked spec and constraints. "
                        "Call when the user asks how to achieve an outcome or which levers to pull."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_outcome": {"type": "string", "description": "Variable or outcome to target."},
                            "constraints_json": {"type": "string", "description": "Optional JSON string of feasibility constraints."},
                        },
                        "required": [],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "predict_artifact",
                    "description": (
                        "Predict distribution of a variable/artifact at a future time T. Use for: 'what will X be at T?', "
                        "'future value of Y', 'distribution at time T'. Requires locked spec. Do not invent future values—call this tool."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "artifact": {"type": "string", "description": "Variable or artifact id (e.g. X, price)."},
                            "time": {"type": "integer", "description": "Time index T."},
                            "observed_path": {"type": "object", "description": "Optional path: {times: number[], data: {var: number[]}}."},
                            "n": {"type": "integer", "description": "Number of trajectories (default 100)."},
                            "seed": {"type": "integer", "description": "Random seed."},
                            "use_unified_loop": {"type": "boolean", "description": "Run until confident (default false)."},
                        },
                        "required": ["artifact", "time"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "p_event",
                    "description": (
                        "Compute P(event) over trajectories. Event = variable at time T with condition (e.g. in range, > threshold). "
                        "Use for: 'probability that X_T > k', 'chance that Y is in [a,b] at T'. Requires locked spec. Do not invent probabilities—call this tool."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "event": {
                                "type": "object",
                                "description": "Event: artifact (string), time (int), op (in|gt|gte|lt|lte|eq), value, value_low, value_high.",
                            },
                            "observed_path": {"type": "object", "description": "Optional path: {times: number[], data: {var: number[]}}."},
                            "n": {"type": "integer", "description": "Number of trajectories (default 100)."},
                            "seed": {"type": "integer", "description": "Random seed."},
                            "use_unified_loop": {"type": "boolean", "description": "Run until confident (default false)."},
                        },
                        "required": ["event"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "nested_mc_p_event",
                    "description": (
                        "Compute P(event) across multiple scenarios (Nested MC: K scenarios x M trajectories). "
                        "Use when the user asks for probability under different interventions or policies (e.g. 'P(outcome) under policy A vs B'). "
                        "Pass a list of scenarios; each scenario can have intervention_schedule (by_time: t -> {var: value}). Requires locked spec."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "event": {
                                "type": "object",
                                "description": "Event: artifact, time, op, value, value_low, value_high.",
                            },
                            "scenarios": {
                                "type": "array",
                                "description": "List of scenarios: each {scenario_id?, intervention_schedule?: {by_time: {t: {var: value}}}}.",
                            },
                            "m_per_scenario": {"type": "integer", "description": "Trajectories per scenario (default 20)."},
                            "observed_path": {"type": "object", "description": "Optional path."},
                            "seed": {"type": "integer", "description": "Random seed."},
                        },
                        "required": ["event", "scenarios"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "nested_mc_predict_artifact",
                    "description": (
                        "Predict distribution of artifact at time T across multiple scenarios (Nested MC: K x M). "
                        "Use when the user asks for future value or distribution under different interventions or policies. "
                        "Pass scenarios list; each can have intervention_schedule. Requires locked spec."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "artifact": {"type": "string", "description": "Variable or artifact id."},
                            "time": {"type": "integer", "description": "Time index T."},
                            "scenarios": {
                                "type": "array",
                                "description": "List of scenarios: each {scenario_id?, intervention_schedule?: {by_time: {...}}}.",
                            },
                            "m_per_scenario": {"type": "integer", "description": "Trajectories per scenario (default 20)."},
                            "observed_path": {"type": "object", "description": "Optional path."},
                            "seed": {"type": "integer", "description": "Random seed."},
                            "return_samples": {"type": "boolean", "description": "Include samples in result (default true)."},
                        },
                        "required": ["artifact", "time", "scenarios"],
                    },
                },
            },
        ]

    def _get_file_operations_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for file operations tools.
        
        Returns:
            List of tool schema dictionaries
        """
        schemas = []
        
        # write_file tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Write content to a file. Creates parent directories if needed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to the file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write to the file"
                        },
                        "encoding": {
                            "type": "string",
                            "default": "utf-8",
                            "description": "File encoding (default: utf-8)"
                        }
                    },
                    "required": ["filepath", "content"]
                }
            }
        })
        
        # read_file tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read content from a file",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to the file to read"
                        },
                        "encoding": {
                            "type": "string",
                            "default": "utf-8",
                            "description": "File encoding (default: utf-8)"
                        }
                    },
                    "required": ["filepath"]
                }
            }
        })
        
        # list_directory tool
        schemas.append({
            "type": "function",
            "function": {
                "name": "list_directory",
                "description": "List files and directories in a path",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "directory_path": {
                            "type": "string",
                            "description": "Path to the directory to list"
                        },
                        "recursive": {
                            "type": "boolean",
                            "default": False,
                            "description": "Whether to list recursively"
                        }
                    },
                    "required": ["directory_path"]
                }
            }
        })
        
        return schemas
    
    @staticmethod
    def _get_image_annotation_engine() -> Optional[Any]:
        """Get or create singleton image annotation engine instance.
        
        Returns:
            ImageAnnotationEngine instance or None if not available
        """
        global _image_annotation_engine
        if not IMAGE_ANNOTATION_AVAILABLE:
            return None
        if _image_annotation_engine is None:
            try:
                _image_annotation_engine = ImageAnnotationEngine()
                logger.info("Image annotation engine initialized")
            except Exception as e:
                logger.error(f"Failed to initialize image annotation engine: {e}")
                return None
        return _image_annotation_engine
    
    def _build_domain_prompt(self, task: str) -> str:
        """Build domain-specific prompt for the given task.
        
        Args:
            task: The task description
            
        Returns:
            Formatted prompt string
        """
        # Include full conversation history if available (capped to control OAI input tokens)
        context = ""
        max_context_chars = 6000
        conversation = getattr(self, "conversation", None)
        if conversation and CONVERSATION_AVAILABLE:
            try:
                history = conversation.conversation_history
                if history:
                    # Get last few messages for context
                    recent = history[-5:] if len(history) > 5 else history
                    context = "\n\n## Recent Conversation Context\n\n"
                    for msg in recent:
                        role = msg.get("role", "Unknown")
                        content = msg.get("content", "")
                        context += f"{role}: {content}\n\n"
                    if len(context) > max_context_chars:
                        context = context[: max_context_chars - 20] + "\n\n... [truncated]"
            except Exception as e:
                logger.debug(f"Error building conversation context: {e}")
        
        prompt = f"{task}\n{context}"
        return prompt
    
    def _domain_specific_setup(self) -> None:
        """Set up domain-specific attributes and integrations."""
        # Set up tools list
        tools_list = []
        
        if AGENT_DISCOVERY_AVAILABLE and self.config.enable_agent_routing:
            tools_list.extend(self._get_agent_discovery_schemas())
        
        if TOOL_DISCOVERY_AVAILABLE:
            tools_list.extend(self._get_tool_discovery_schemas())
        
        # Add web search (DuckDuckGo) for current events past training cutoff
        if getattr(self.config, "enable_web_search", True) and DDGS_AVAILABLE:
            tools_list.extend(self._get_web_search_schema())
            if not hasattr(self, "tools") or self.tools is None:
                self.tools = []
            def web_search(
                query: str,
                max_results: int = 5,
            ) -> Dict[str, Any]:
                """Search the web via DuckDuckGo. Returns current information for events past training cutoff."""
                try:
                    n = max(1, min(10, int(max_results)))
                    results = []
                    with DDGS() as ddgs:
                        for r in ddgs.text(query, max_results=n):
                            results.append({
                                "title": r.get("title", ""),
                                "body": r.get("body", ""),
                                "href": r.get("href", ""),
                            })
                    return {"query": query, "results": results}
                except Exception as e:
                    logger.warning(f"web_search failed: {e}")
                    return {"query": query, "results": [], "error": str(e)}
            self.add_tool(web_search)
            logger.info("Web search (DuckDuckGo) tool added to GeneralAgent")

        # Add CRCA-Q style market data tools (search pairs, OHLC bars)
        if getattr(self.config, "enable_market_data", True) and REQUESTS_AVAILABLE:
            tools_list.extend(self._get_market_data_schemas())
            if not hasattr(self, "tools") or self.tools is None:
                self.tools = []
            def market_search(query: str = "") -> Dict[str, Any]:
                """Return available trading pairs (Solana DEX tokens from CoinGecko), optionally filtered by query."""
                try:
                    pairs = _market_pairs_registry(query if query else None)
                    return {"pairs": pairs, "total": len(pairs), "source": "coingecko"}
                except RuntimeError as e:
                    return {"pairs": [], "total": 0, "error": str(e)}
            def get_market_ohlc(
                symbol: str,
                timeframe: str = "15Min",
                limit: int = 100,
            ) -> Dict[str, Any]:
                """Get OHLC bars for a Solana DEX pair (CoinGecko). Use market_search to list valid symbols."""
                n = max(1, min(500, int(limit)))
                coin_id = _coingecko_resolve_symbol(symbol)
                if not coin_id:
                    return {
                        "symbol": symbol,
                        "bars": [],
                        "source": None,
                        "error": f"Unknown symbol for Solana DEX: {symbol}. Use market_search to list valid pairs.",
                    }
                days = _MARKET_TIMEFRAME_TO_DAYS.get((timeframe or "").strip(), 7)
                try:
                    bars = _market_bars_coingecko(coin_id, days=days, limit=n)
                    return {"symbol": symbol, "bars": bars, "source": "coingecko"}
                except RuntimeError as e:
                    return {"symbol": symbol, "bars": [], "source": "coingecko", "error": str(e)}
            self.add_tool(market_search)
            self.add_tool(get_market_ohlc)
            logger.info("Market data (CRCA-Q style) tools added to GeneralAgent")

        # Causal core tools: identify, estimate, counterfactual, design_intervention (tool-mandatory for numeric outputs)
        if CRCA_CORE_AVAILABLE and getattr(self.config, "enable_causal_reasoning", True):
            tools_list.extend(self._get_causal_core_schemas())
            if not hasattr(self, "tools") or self.tools is None:
                self.tools = []
            self._crca_locked_spec: Optional[Any] = None
            self._crca_tool_router = ToolRouter()
            self._crca_tool_invocations: List[str] = []

            def _record_crca_tool_call(name: str) -> None:
                try:
                    log = getattr(self, "_crca_tool_invocations", None)
                    if isinstance(log, list):
                        log.append(name)
                except Exception:
                    return

            def _get_locked_spec() -> Optional[Any]:
                spec = getattr(self, "_crca_locked_spec", None)
                if spec is None:
                    return None
                if isinstance(spec, dict):
                    try:
                        return LockedSpec.model_validate(spec)
                    except Exception:
                        return None
                return spec if isinstance(spec, LockedSpec) else None

            def identify(treatment: str, outcome: str) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("identify")
                res = self._crca_tool_router.call_tool(
                    tool_name="identify",
                    payload={"locked_spec": locked, "treatment": treatment or "", "outcome": outcome or ""},
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            def estimate(
                treatment: str,
                outcome: str,
                data: Optional[Dict[str, Any]] = None,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("estimate")
                res = self._crca_tool_router.call_tool(
                    tool_name="estimate",
                    payload={"locked_spec": locked, "treatment": treatment or "", "outcome": outcome or "", "data": data},
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            def counterfactual(
                factual_observation: Dict[str, float],
                intervention: Dict[str, float],
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("counterfactual")
                res = self._crca_tool_router.call_tool(
                    tool_name="counterfactual",
                    payload={
                        "locked_spec": locked,
                        "factual_observation": factual_observation or {},
                        "intervention": intervention or {},
                    },
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            def design_intervention_tool(
                target_outcome: Optional[str] = None,
                constraints_json: Optional[str] = None,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("design_intervention")
                from crca_core.core.intervention_design import TargetQuery, FeasibilityConstraints
                tq = TargetQuery(outcome=target_outcome) if target_outcome else TargetQuery()
                constraints = FeasibilityConstraints()
                if constraints_json:
                    try:
                        import json
                        c = json.loads(constraints_json)
                        constraints = FeasibilityConstraints(**{k: v for k, v in c.items() if k in FeasibilityConstraints.model_fields})
                    except Exception:
                        pass
                res = self._crca_tool_router.call_tool(
                    tool_name="design_intervention",
                    payload={"locked_spec": locked, "target_query": tq, "constraints": constraints},
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            design_intervention_tool.__name__ = "design_intervention"

            def predict_artifact(
                artifact: str,
                time: int,
                observed_path: Optional[Dict[str, Any]] = None,
                n: int = 100,
                seed: Optional[int] = None,
                use_unified_loop: bool = False,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("predict_artifact")
                res = self._crca_tool_router.call_tool(
                    tool_name="predict_artifact",
                    payload={
                        "locked_spec": locked,
                        "artifact": artifact,
                        "time": int(time),
                        "observed_path": observed_path,
                        "n": n,
                        "seed": seed,
                        "use_unified_loop": use_unified_loop,
                    },
                )
                if hasattr(res, "model_dump"):
                    return res.model_dump()
                if isinstance(res, list):
                    return {"paths": [p.model_dump() for p in res]}
                return {"result": str(res)}

            def p_event(
                event: Dict[str, Any],
                observed_path: Optional[Dict[str, Any]] = None,
                n: int = 100,
                seed: Optional[int] = None,
                use_unified_loop: bool = False,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("p_event")
                res = self._crca_tool_router.call_tool(
                    tool_name="p_event",
                    payload={
                        "locked_spec": locked,
                        "event": event,
                        "observed_path": observed_path,
                        "n": n,
                        "seed": seed,
                        "use_unified_loop": use_unified_loop,
                    },
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            def nested_mc_p_event(
                event: Dict[str, Any],
                scenarios: List[Dict[str, Any]],
                m_per_scenario: int = 20,
                observed_path: Optional[Dict[str, Any]] = None,
                seed: Optional[int] = None,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("nested_mc_p_event")
                res = self._crca_tool_router.call_tool(
                    tool_name="nested_mc_p_event",
                    payload={
                        "locked_spec": locked,
                        "event": event,
                        "scenarios": scenarios,
                        "m_per_scenario": m_per_scenario,
                        "observed_path": observed_path,
                        "seed": seed,
                    },
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            def nested_mc_predict_artifact(
                artifact: str,
                time: int,
                scenarios: List[Dict[str, Any]],
                m_per_scenario: int = 20,
                observed_path: Optional[Dict[str, Any]] = None,
                seed: Optional[int] = None,
                return_samples: bool = True,
            ) -> Dict[str, Any]:
                locked = _get_locked_spec()
                if locked is None:
                    return {"refusal": True, "message": "LockedSpec required. Lock a causal spec first, then retry."}
                _record_crca_tool_call("nested_mc_predict_artifact")
                res = self._crca_tool_router.call_tool(
                    tool_name="nested_mc_predict_artifact",
                    payload={
                        "locked_spec": locked,
                        "artifact": artifact,
                        "time": int(time),
                        "scenarios": scenarios,
                        "m_per_scenario": m_per_scenario,
                        "observed_path": observed_path,
                        "seed": seed,
                        "return_samples": return_samples,
                    },
                )
                return res.model_dump() if hasattr(res, "model_dump") else {"result": str(res)}

            self.add_tool(identify)
            self.add_tool(estimate)
            self.add_tool(counterfactual)
            self.add_tool(design_intervention_tool)
            self.add_tool(predict_artifact)
            self.add_tool(p_event)
            self.add_tool(nested_mc_p_event)
            self.add_tool(nested_mc_predict_artifact)
            logger.info(
                "Causal core tools (identify, estimate, counterfactual, design_intervention, "
                "predict_artifact, p_event, nested_mc_p_event, nested_mc_predict_artifact) added to GeneralAgent"
            )

        # Image annotation/query: attached images MUST go through this pipeline first (see _comprehensive_error_handler)
        if IMAGE_ANNOTATION_AVAILABLE and getattr(self.config, "enable_image_annotation", True):
            tools_list.extend(self._get_image_annotation_schemas())
            if not hasattr(self, "tools") or self.tools is None:
                self.tools = []

            def annotate_image(
                image_path: str,
                output_format: str = "all",
                frame_id: Optional[int] = None,
            ) -> Dict[str, Any]:
                """Tool handler for annotate_image."""
                engine = self._get_image_annotation_engine()
                if engine is None:
                    return {"error": "Image annotation engine not available"}
                try:
                    result = engine.annotate(image_path, frame_id=frame_id, output=output_format)
                    if output_format == "overlay":
                        return {"overlay_image": "numpy array returned", "shape": str(result.shape) if hasattr(result, "shape") else "unknown"}
                    if output_format == "json":
                        return result
                    if output_format == "report":
                        return {"report": result}
                    return {
                        "entities": len(result.annotation_graph.entities),
                        "labels": len(result.annotation_graph.labels),
                        "contradictions": len(result.annotation_graph.contradictions),
                        "processing_time": result.processing_time,
                        "formal_report": (result.formal_report[:500] + "..." if len(result.formal_report) > 500 else result.formal_report),
                        "json_summary": {k: str(v)[:200] for k, v in list(result.json_output.items())[:5]},
                    }
                except Exception as e:
                    logger.error("Error in annotate_image tool: %s", e)
                    return {"error": str(e)}

            def query_image(
                image_path: str,
                query: str,
                frame_id: Optional[int] = None,
            ) -> Dict[str, Any]:
                """Tool handler for query_image."""
                engine = self._get_image_annotation_engine()
                if engine is None:
                    return {"error": "Image annotation engine not available"}
                try:
                    result = engine.query(image_path, query, frame_id=frame_id)
                    return {
                        "answer": result["answer"],
                        "entities_found": len(result["entities"]),
                        "measurements": result["measurements"],
                        "confidence": result["confidence"],
                        "reasoning": (result["reasoning"][:500] + "..." if len(result["reasoning"]) > 500 else result["reasoning"]),
                    }
                except Exception as e:
                    logger.error("Error in query_image tool: %s", e)
                    return {"error": str(e)}

            self.add_tool(annotate_image)
            self.add_tool(query_image)
            logger.info("Image annotation/query tools added to GeneralAgent")

        # Expose OpenAI-format tool schemas so OpenAIDirectLLM can send tools when Swarms does not pass them in kwargs.
        self.tools_list_dictionary = tools_list if tools_list else getattr(self, "tools_list_dictionary", None)
        logger.debug("Domain-specific setup complete")

    def _fetch_livefetch_context(self, task: str, max_results: int = 5) -> str:
        """Run LiveFetch (discovery + fetch + extract + score) and return formatted evidence for the system prompt.
        Uses keyless sources (DDG, Reddit, HN, ArXiv, market APIs, etc.) and returns EvidencePackets with
        title, url, score, quotes, and text. Returns empty string if LiveFetch unavailable or fails.
        """
        if not LIVEFETCH_AVAILABLE or not LiveFetch or not RIntent:
            return ""
        query = (task or "").strip()
        if not query or len(query) < 2:
            query = "current date and news today"
        else:
            words = query.split()
            query = " ".join(words[:12]) if len(words) > 12 else query
            if len(query) > 80:
                query = query[:77] + "..."
        try:
            intent = RIntent(
                query=query,
                mode="news",
                max_results=max(1, min(8, max_results)),
                freshness_days=14,
                need_quotes=True,
            )
            with LiveFetch() as lf:
                packets = lf.run_sync(intent)
            if not packets:
                return ""
            lines = ["Live web evidence (LiveFetch) — use this to ground your response when relevant:"]
            for i, p in enumerate(packets, 1):
                title = (p.title or "Untitled").strip()
                text_snippet = (p.text or "")[:500].strip()
                if len((p.text or "")) > 500:
                    text_snippet += "..."
                lines.append(f"  {i}. [{title}] (score: {getattr(p, 'score', 0):.2f})")
                lines.append(f"     URL: {p.url}")
                if getattr(p, "quotes", None):
                    for q in p.quotes[:2]:
                        lines.append(f"     Quote: {q[:200]}{'...' if len(q) > 200 else ''}")
                lines.append(f"     Content: {text_snippet}")
            return "\n".join(lines)
        except Exception as e:
            logger.debug("LiveFetch pre-query failed: %s", e)
            return ""

    def _fetch_ddgs_context(self, task: str, max_results: int = 5) -> str:
        """Run DuckDuckGo search from the user task and return formatted context for the system prompt.
        Called before every response so the agent has up-to-date web data. Fallback when LiveFetch unavailable.
        """
        if not DDGS_AVAILABLE or DDGS is None:
            return ""
        query = (task or "").strip()
        if not query or len(query) < 2:
            query = "current date and news today"
        else:
            # Use first ~80 chars or first 12 words as search query to avoid overly long queries
            words = query.split()
            query = " ".join(words[:12]) if len(words) > 12 else query
            if len(query) > 80:
                query = query[:77] + "..."
        try:
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max(1, min(8, max_results))):
                    title = (r.get("title") or "").strip()
                    body = (r.get("body") or "").strip()
                    href = (r.get("href") or "").strip()
                    if title or body:
                        results.append({"title": title, "body": body, "href": href})
            if not results:
                return ""
            lines = ["Recent web context (DuckDuckGo) â€” use this to ground your response when relevant:"]
            for i, item in enumerate(results, 1):
                lines.append(f"  {i}. [{item['title']}] {item['body'][:300]}{'...' if len(item.get('body', '')) > 300 else ''}")
                if item.get("href"):
                    lines.append(f"     Source: {item['href']}")
            return "\n".join(lines)
        except Exception as e:
            logger.debug("DDGS pre-query failed: %s", e)
            return ""

    def _run_attached_image_analysis(self, paths: List[str]) -> str:
        """Run image annotation/query on attached paths. Image MUST go through this pipeline.
        Returns combined report text. Raises on failure (caller retries)."""
        engine = self._get_image_annotation_engine()
        if engine is None:
            raise RuntimeError("Image annotation engine not available")
        reports: List[str] = []
        default_query = "Describe the image content, structure, and any measurable elements."
        for path in paths:
            path = (path or "").strip()
            if not path:
                continue
            try:
                # Prefer query() so we get a natural-language answer; fallback to annotate report
                result = engine.query(path, default_query)
                if isinstance(result, dict) and result.get("answer"):
                    reports.append(f"[{path}]\n{result['answer']}")
                else:
                    report_text = engine.annotate(path, output="report")
                    reports.append(f"[{path}]\n{report_text}")
            except Exception as e:
                logger.warning("Image analysis failed for %s: %s", path, e)
                report_text = engine.annotate(path, output="report")
                if isinstance(report_text, str):
                    reports.append(f"[{path}]\n{report_text}")
                else:
                    raise RuntimeError(f"Image analysis failed for {path}: {e}") from e
        if not reports:
            raise RuntimeError("No image analysis produced (empty paths or engine error)")
        return "\n\n---\n\n".join(reports)

    def _comprehensive_error_handler(
        self,
        task: str,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> str:
        """Comprehensive error handling with retry, fallback, and user guidance.
        
        Args:
            task: Task to execute
            max_retries: Maximum number of retries
            retry_delay: Initial retry delay (exponential backoff)
            
        Returns:
            Response string
        """
        last_error = None

        # When images are attached, image MUST go through annotation/query tool first (before prompt).
        attached_image_paths: List[str] = list(getattr(self, "_attached_image_paths", None) or [])
        if attached_image_paths:
            analysis_retries = 3
            analysis_report: Optional[str] = None
            last_analysis_error: Optional[Exception] = None
            for ar in range(analysis_retries):
                try:
                    analysis_report = self._run_attached_image_analysis(attached_image_paths)
                    break
                except Exception as e:
                    last_analysis_error = e
                    logger.warning("Attached image analysis attempt %s/%s failed: %s", ar + 1, analysis_retries, e)
                    if ar < analysis_retries - 1:
                        time.sleep(1.0 * (ar + 1))
            setattr(self, "_attached_image_paths", [])
            if analysis_report is None:
                err_msg = (
                    f"Image analysis failed after {analysis_retries} attempts: {last_analysis_error}. "
                    "Please report to devs."
                )
                logger.error("REPORT_TO_DEVS: %s", err_msg, exc_info=last_analysis_error)
                return f"[Error] {err_msg}"
            task = "## Image analysis (attached images):\n" + analysis_report + "\n\n## User message:\n" + task

        for attempt in range(max_retries):
            try:
                # Apply rate limiting (only if this agent has a rate limiter)
                rate_limiter = getattr(self, "rate_limiter", None)
                if rate_limiter:
                    user_id = getattr(self, "_user_id", "default")
                    is_allowed, error_msg = rate_limiter.check_rate_limit(user_id)
                    if not is_allowed:
                        rate_limiter.wait_if_rate_limited(user_id, max_wait=60.0)
                
                # Try to route to specialized agent first (route-first strategy)
                if AGENT_DISCOVERY_AVAILABLE and self.config.enable_agent_routing:
                    try:
                        available_agents = discover_all_agents(
                            aop_instances=[self._aop_instance] if self._aop_instance else None,
                            router_instances=[self._router_instance] if self._router_instance else None,
                        )
                        
                        if available_agents:
                            best_agent = find_best_agent_for_task(
                                task,
                                available_agents,
                                aop_instances=[self._aop_instance] if self._aop_instance else None,
                                router_instances=[self._router_instance] if self._router_instance else None,
                            )
                            
                            if best_agent:
                                agent_name, agent_instance, source = best_agent
                                logger.info(f"Routing task to specialized agent: {agent_name} (source: {source})")
                                result = route_to_agent(
                                    agent_name,
                                    task,
                                    aop_instances=[self._aop_instance] if self._aop_instance else None,
                                    router_instances=[self._router_instance] if self._router_instance else None,
                                )
                                if result:
                                    return str(result)
                    except Exception as e:
                        logger.debug(f"Agent routing failed, falling back to direct handling: {e}")
                
                # Direct handling (pass through img, imgs, streaming_callback if available)
                run_kwargs = {}
                if hasattr(self, "_current_img") and self._current_img:
                    run_kwargs["img"] = self._current_img
                if hasattr(self, "_current_imgs") and self._current_imgs:
                    run_kwargs["imgs"] = self._current_imgs
                if hasattr(self, "_current_streaming_callback") and self._current_streaming_callback:
                    run_kwargs["streaming_callback"] = self._current_streaming_callback
                if hasattr(self, "_current_kwargs") and isinstance(self._current_kwargs, dict):
                    run_kwargs.update(self._current_kwargs)

                # Always run web evidence before response: prefer LiveFetch, fallback to DDGS; inject into system prompt
                _web_context = self._fetch_livefetch_context(task)
                if not _web_context:
                    _web_context = self._fetch_ddgs_context(task)
                _original_system_prompt = getattr(self, "system_prompt", None)
                try:
                    _date_line = (
                        f"\n\nCurrent date and time (always use this for date/time queries): "
                        f"{datetime.now(timezone.utc).strftime('%A, %B %d, %Y, %H:%M UTC')}."
                    )
                    self.system_prompt = (_original_system_prompt or "") + _date_line
                    if _web_context:
                        self.system_prompt = self.system_prompt + "\n\n" + _web_context

                    # Optional: nudge LLM to consider predict_artifact / p_event / nested_mc when task suggests it
                    if getattr(self.config, "enable_causal_temporal_nudge", True) and getattr(self, "_crca_locked_spec", None):
                        _task_lower = (task or "").lower()
                        _keywords = (
                            "future", "at time t", "probability", "p(", "distribution at", "what will",
                            "chance that", "across scenarios", "under policy", "compare scenarios",
                        )
                        if any(k in _task_lower for k in _keywords):
                            self.system_prompt = (
                                self.system_prompt + "\n\nThis query may involve a future value, event probability, or multiple scenarios; "
                                "if you have a causal spec, consider using predict_artifact, p_event, or the nested_mc_* tools."
                            )

                    response = super().run(task, **run_kwargs)
                    response = self._normalize_run_response(response)
                    conversation = getattr(self, "conversation", None)
                    if conversation:
                        try:
                            conversation.add("User", task)
                            conversation.add(self.agent_name, response)
                        except Exception as e:
                            logger.debug(f"Error saving to conversation: {e}")
                    return response
                finally:
                    self.system_prompt = _original_system_prompt
                
            except Exception as e:
                last_error = e
                logger.warning(
                    "Attempt %s/%s failed: %s",
                    attempt + 1,
                    max_retries,
                    e,
                    exc_info=True,
                )
                
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    time.sleep(wait_time)
                else:
                    try:
                        fallback_prompt = f"Please provide a helpful response to: {task}"
                        response = super().run(fallback_prompt)
                        response = self._normalize_run_response(response)
                        logger.info("Used fallback response after main run failed: %s", str(last_error)[:200])
                        return response
                    except Exception as fallback_error:
                        error_msg = (
                            f"Failed after {max_retries} retries. Last error: {str(last_error)}. "
                            f"Fallback also failed: {str(fallback_error)}. Please report to devs."
                        )
                        logger.error(
                            "REPORT_TO_DEVS: Agent failed after retries and fallback failed. last_error=%s fallback_error=%s",
                            last_error,
                            fallback_error,
                            exc_info=True,
                        )
                        return f"[Error] {error_msg}"
        
        logger.error(
            "REPORT_TO_DEVS: Agent failed after %s attempts. last_error=%s",
            max_retries,
            last_error,
            exc_info=True,
        )
        return f"[Error] Failed to process task after {max_retries} attempts: {str(last_error)}. Please report to devs."

    def _normalize_run_response(self, response: Any) -> str:
        """Ensure run() returns a proper string for chat. Handles empty list / '[]' from history formatter."""
        if response is None:
            return "Hello! How can I help you today?"
        if isinstance(response, list):
            if len(response) == 0:
                return self._last_agent_content_or_default()
            if len(response) == 1 and isinstance(response[0], str) and response[0].strip():
                return response[0]
            for item in reversed(response):
                if isinstance(item, dict):
                    text = item.get("content") or item.get("message") or item.get("text")
                    if isinstance(text, str) and text.strip():
                        return text
            return self._last_agent_content_or_default()
        s = str(response).strip()
        if s in ("[]", "") or s.startswith("[]"):
            return self._last_agent_content_or_default()
        return s

    def _last_agent_content_or_default(self) -> str:
        default = "Hello! How can I help you today?"
        try:
            mem = getattr(self, "short_memory", None)
            if mem is None:
                return default
            history = getattr(mem, "conversation_history", None) or getattr(mem, "message_history", None)
            if isinstance(history, (list, tuple)) and len(history) > 0:
                for msg in reversed(history):
                    if isinstance(msg, dict) and msg.get("role") == self.agent_name:
                        content = msg.get("content", "")
                        if isinstance(content, str) and content.strip() and content.strip() != "[]":
                            return content
                    if hasattr(msg, "role") and getattr(msg, "role", None) == self.agent_name:
                        content = getattr(msg, "content", "") or ""
                        if content and str(content).strip() != "[]":
                            return str(content)
            return default
        except Exception:
            return default

    def run(
        self,
        task: Optional[Union[str, Any]] = None,
        img: Optional[str] = None,
        imgs: Optional[List[str]] = None,
        streaming_callback: Optional[Callable[[str], None]] = None,
        **kwargs,
    ) -> Any:
        """Run the agent with comprehensive error handling."""
        if task is None:
            task = ""
        
        self._current_img = img
        self._current_imgs = imgs
        self._current_streaming_callback = streaming_callback
        self._current_kwargs = kwargs
        attached_image_paths = kwargs.pop("attached_image_paths", None)
        self._attached_image_paths = list(attached_image_paths) if attached_image_paths else []
        max_retries = kwargs.pop("max_retries", 3)

        return self._comprehensive_error_handler(str(task), max_retries=max_retries)

    def clear_conversation(self) -> None:
        """Clear the agent's short-term conversation history (user/assistant turns)."""
        try:
            if hasattr(self, "short_memory") and self.short_memory is not None:
                if hasattr(self.short_memory, "clear") and callable(getattr(self.short_memory, "clear", None)):
                    self.short_memory.clear()
                elif hasattr(self.short_memory, "conversation_history"):
                    self.short_memory.conversation_history = []
            logger.debug("Cleared agent conversation history")
        except Exception as e:
            logger.warning("clear_conversation failed (non-fatal): %s", e)

    async def run_async(
        self,
        task: Optional[Union[str, Any]] = None,
        img: Optional[str] = None,
        imgs: Optional[List[str]] = None,
        **kwargs,
    ) -> Any:
        """Run the agent asynchronously."""
        if task is None:
            task = ""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return await loop.run_in_executor(None, self.run, task, img, imgs, **kwargs)

    def run_batch(
        self,
        tasks: List[str],
        task_ids: Optional[List[str]] = None,
        user_id: str = "default",
    ) -> Tuple[List[Any], Any]:
        """Process a batch of tasks."""
        if not BATCH_PROCESSOR_AVAILABLE or not self.batch_processor:
            results = [self.run(t) for t in tasks]
            return results, None
        return self.batch_processor.process_batch(
            tasks=tasks,
            task_fn=self.run,
            task_ids=task_ids,
            user_id=user_id,
        )

    async def run_batch_async(
        self,
        tasks: List[str],
        task_ids: Optional[List[str]] = None,
        user_id: str = "default",
    ) -> Tuple[List[Any], Any]:
        """Process a batch of tasks asynchronously."""
        if not BATCH_PROCESSOR_AVAILABLE or not self.batch_processor:
            results = await asyncio.gather(*[self.run_async(t) for t in tasks])
            return results, None
        return await self.batch_processor.process_batch_async(
            tasks=tasks,
            task_fn=self.run_async,
            task_ids=task_ids,
            user_id=user_id,
        )

    def save_conversation(self, filepath: Optional[str] = None) -> None:
        """Save conversation to file."""
        conversation = getattr(self, "conversation", None)
        if not conversation:
            logger.warning("Conversation persistence not enabled")
            return
        try:
            if filepath:
                conversation.save_filepath = filepath
            if hasattr(conversation, "save_with_metadata"):
                conversation.save_with_metadata(force=True)
            else:
                conversation.export(force=True)
            _path = getattr(conversation, "save_filepath", filepath or "default")
            logger.info("Conversation saved to %s", _path)
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")

    def load_conversation(self, filepath: str) -> None:
        """Load conversation from file."""
        if not CONVERSATION_AVAILABLE:
            logger.warning("Conversation utilities not available")
            return
        try:
            conversation = getattr(self, "conversation", None)
            if not conversation:
                self.conversation = Conversation(
                    name=self.agent_name,
                    load_filepath=filepath,
                )
            else:
                conversation.load(filepath)
            logger.info(f"Conversation loaded from {filepath}")
        except Exception as e:
            logger.error(f"Failed to load conversation: {e}")
