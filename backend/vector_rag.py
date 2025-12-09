"""
Vector-Based RAG System for Trading Strategy Generation

Features:
1. ChromaDB for vector storage
2. Sentence-transformers for detailed embeddings (all-mpnet-base-v2)
3. Cross-Encoder for re-ranking (ms-marco-MiniLM-L-6-v2)
4. Enriched block descriptions for better semantic matching
"""

import os
import shutil
from typing import Dict, List, Optional, Tuple
import json

# Lazy imports to avoid startup slowdown
_chromadb = None
_embedding_model = None
_cross_encoder = None


def get_chromadb():
    """Lazy load ChromaDB."""
    global _chromadb
    if _chromadb is None:
        import chromadb
        _chromadb = chromadb
    return _chromadb


def get_embedding_model():
    """Lazy load sentence-transformers model."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        # Use a higher quality model for embeddings
        print("[VECTOR-RAG] Loading embedding model: all-mpnet-base-v2...")
        _embedding_model = SentenceTransformer('all-mpnet-base-v2')
        print("[VECTOR-RAG] Loaded embedding model: all-mpnet-base-v2")
    return _embedding_model


def get_cross_encoder():
    """Lazy load cross-encoder model."""
    global _cross_encoder
    if _cross_encoder is None:
        from sentence_transformers import CrossEncoder
        # Use a fast but effective cross-encoder
        print("[VECTOR-RAG] Loading re-ranker: cross-encoder/ms-marco-MiniLM-L-6-v2...")
        _cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
        print("[VECTOR-RAG] Loaded re-ranker")
    return _cross_encoder


# ============================================================================
# STRATEGY TYPE CLASSIFICATION
# ============================================================================

STRATEGY_TYPES = {
    "MOMENTUM": {
        "description": "Trade based on overbought/oversold conditions",
        "indicators": ["ta_rsi", "ta_stochastic", "ta_cci", "ta_mfi", "momentum"],
        "keywords": ["rsi", "overbought", "oversold", "momentum", "stochastic", "divergence"]
    },
    "TREND": {
        "description": "Follow established market trends",
        "indicators": ["ta_sma", "ta_ema", "ta_adx", "ta_supertrend", "macd_value"],
        "keywords": ["trend", "crossover", "moving average", "sma", "ema", "adx", "following", "macd"]
    },
    "MEAN_REVERSION": {
        "description": "Trade price returning to average",
        "indicators": ["ta_bb", "ta_sma", "ta_rsi", "ta_cci"],
        "keywords": ["bollinger", "bands", "mean reversion", "reversion", "bounce", "pullback", "deviation"]
    },
    "BREAKOUT": {
        "description": "Trade when price breaks key levels",
        "indicators": ["ta_highest", "ta_lowest", "ta_donchian", "ta_atr", "ta_bb"],
        "keywords": ["breakout", "support", "resistance", "channel", "donchian", "range", "break"]
    },
    "VOLATILITY": {
        "description": "Trade based on volatility expansion/contraction",
        "indicators": ["ta_atr", "ta_bb", "ta_keltner"],
        "keywords": ["volatility", "atr", "squeeze", "expansion", "contraction", "range"]
    }
}

CLASSIFIER_PROMPT = """Classify this trading strategy request into ONE category.

Categories:
- MOMENTUM: RSI, MACD, overbought/oversold signals, divergence
- TREND: Moving average crossovers, ADX, following trends, MACD crossovers
- MEAN_REVERSION: Bollinger bands, price returning to average, pullbacks
- BREAKOUT: Support/resistance breaks, channel breakouts, range trading
- VOLATILITY: ATR-based strategies, volatility expansion/contraction

User request: "{query}"

Reply with ONLY the category name (MOMENTUM, TREND, MEAN_REVERSION, BREAKOUT, or VOLATILITY).
If unclear, reply: TREND"""


# ============================================================================
# ENRICHED BLOCK DESCRIPTIONS FOR EMBEDDING
# ============================================================================

BLOCK_DESCRIPTIONS = {
    # Momentum indicators
    "ta_rsi": "Relative Strength Index (RSI). Computes momentum to identify overbought or oversold conditions. Use when strategy involves RSI levels (e.g. > 70 or < 30).",
    "ta_stochastic": "Stochastic Oscillator. Compares a closing price to a range of its prices over a given period. Use for momentum and overbought/oversold signals.",
    "ta_cci": "Commodity Channel Index (CCI). measures the difference between the current price and the historical average price. Use for identifying cyclical trends.",
    "ta_mfi": "Money Flow Index (MFI). A volume-weighted RSI. Use to identify buying and selling pressure.",
    "momentum": "Momentum Indicator. measures the rate of change of price movement. Use to identify the speed of price changes.",
    
    # Trend indicators
    "ta_sma": "Simple Moving Average (SMA). Calculates the average price over a specific number of periods. Use for trend following and crossover strategies.",
    "ta_ema": "Exponential Moving Average (EMA). Similar to SMA but gives more weight to recent prices. Use for faster trend detection and crossovers.",
    "ta_adx": "Average Directional Index (ADX). Measures the strength of a trend regardless of direction. Use to filter out weak trends.",
    "ta_supertrend": "SuperTrend Indicator. A trend-following indicator based on ATR. Use to determine trend direction and potential reversal points.",
    "macd_value": "Moving Average Convergence Divergence (MACD). A trend-following momentum indicator. Use for crossovers, divergences, and trend direction.",
    
    # Mean reversion indicators
    "ta_bb": "Bollinger Bands. Consists of a middle band (SMA) and two outer bands (standard deviations). Use for volatility and mean reversion (prices returning to the middle).",
    
    # Breakout indicators
    "ta_highest": "Highest High. Returns the highest price over a specified period. Use for breakout strategies (e.g., price breaking above 20-day high).",
    "ta_lowest": "Lowest Low. Returns the lowest price over a specified period. Use for breakout strategies (e.g., price breaking below 20-day low).",
    "ta_donchian": "Donchian Channels. Formed by the highest high and lowest low. Use for breakout trading.",
    
    # Volatility indicators
    "ta_atr": "Average True Range (ATR). Measures market volatility. Use for dynamic stop loss, take profit, and position sizing.",
    "ta_keltner": "Keltner Channels. Volatility-based bands placed above and below an EMA. Use for trend and breakout strategies.",
    
    # Trading blocks
    "trade_order": "Execute a trade. Opens a position (Buy or Sell). Required for any strategy that initiates trades.",
    "trade_stop_loss": "Stop Loss. Sets a price level to close a losing trade. Critical for risk management.",
    "trade_take_profit": "Take Profit. Sets a price level to close a winning trade. Used to lock in profits.",
    "trade_close_all": "Close All Positions. Exits all open trades immediately. Use for end-of-day exits or panic buttons.",
    "trade_entry_price": "Entry Price. The price at which the current position was opened. Use to calculate Stop Loss and Take Profit levels.",
    
    # Math
    "math_number": "Number. A numeric value. Use for setting parameters, thresholds (like RSI 30), or constants.",
    
    # Operators
    "operator_greater": "Greater Than (>). Returns true if the left value is larger than the right value. Use for 'above' comparisons.",
    "operator_less": "Less Than (<). Returns true if the left value is smaller than the right value. Use for 'below' comparisons.",
    "operator_and": "Logical AND. Returns true only if BOTH conditions are true. Use to combine multiple signals.",
    "operator_or": "Logical OR. Returns true if EITHER condition is true. Use for alternative entry signals.",
    "operator_equals": "Equals (==). Returns true if values are identical. Use for checking specific states.",
    
    # Control
    "control_forever": "Forever Loop. The main execution loop of the strategy. This block is REQUIRED to run the strategy continuously.",
    "control_if": "If Statement. Executes the contained blocks only if the condition is true. Use for entry/exit logic.",
    "control_if_else": "If-Else Statement. Executes one block of code if true, another if false. Use for complex logic branching.",
    "control_wait": "Wait. Pauses execution for a specified number of seconds. Use for time delays between actions.",
    "control_wait_until": "Wait Until. Pauses execution until a condition becomes true. Use to wait for specific market conditions.",
    
    # Environment
    "environment_new_candle_open": "New Candle Open. Evaluates to true only once when a new bar begins. REQUIRED for most strategies to prevent re-executing on every tick.",
    "environment_price": "Current Price. The live market price (Close, High, Low, Open). Essential for price-based logic.",
    "environment_volume": "Volume. The number of shares/contracts traded. Use for volume-based confirmation.",
    
    # Risk Management
    "risk_trailing_stop": "Trailing Stop Loss. Dynamically adjusts stop loss to lock in profits as price moves favorably. Use for trend-following strategies.",
    "risk_scale_in": "Scale In. Gradually increases position size at intervals. Use for dollar-cost averaging or pyramid entries.",
    "risk_scale_out": "Scale Out. Gradually reduces position size at intervals. Use to take partial profits while letting winners run.",
    "risk_max_drawdown": "Max Drawdown Protection. Stops trading if account drawdown exceeds a threshold. Critical for capital preservation.",
    "risk_daily_loss_limit": "Daily Loss Limit. Stops trading for the day if losses exceed a set amount. Use to prevent revenge trading.",
    "risk_position_percent": "Position Size by Percent. Calculates position size as a percentage of account equity. Use for consistent risk per trade.",
    "risk_kelly_criterion": "Kelly Criterion. Calculates optimal position size based on win rate and win/loss ratio. Use for mathematically optimal sizing.",
    "risk_fixed_amount": "Fixed Position Size. Uses a constant position size regardless of account balance. Simple but less adaptive.",
}


# ============================================================================
# VECTOR RAG CLASS
# ============================================================================

class VectorRAG:
    """
    Enhanced Vector-based RAG system.
    
    Capabilities:
    - Semantic Search (ChromaDB + all-mpnet-base-v2)
    - Re-ranking (Cross-Encoder)
    """
    
    def __init__(self, persist_directory: str = "./chroma_db_v2"):
        # Note: changed directory name to avoid conflict/corruption with old db
        self.persist_directory = persist_directory
        self.collection = None
        self.initialized = False
        
    def initialize(self, force_reindex: bool = False):
        """Initialize ChromaDB and create embeddings if needed."""
        if self.initialized and not force_reindex:
            return
            
        try:
            chromadb = get_chromadb()
            # Ensure model is downloaded
            get_embedding_model()
            
            # Create persistent client
            if not os.path.exists(self.persist_directory):
                os.makedirs(self.persist_directory)
                
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            
            # Delete collection if forcing reindex
            if force_reindex:
                try:
                    self.client.delete_collection("trading_blocks_v2")
                    print("[VECTOR-RAG] Deleted old collection for re-indexing")
                except:
                    pass

            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name="trading_blocks_v2",
                metadata={"description": "Trading strategy block embeddings with all-mpnet-base-v2"}
            )
            
            # Check if we need to add embeddings
            if self.collection.count() == 0 or force_reindex:
                print("[VECTOR-RAG] Creating new high-quality embeddings...")
                self._create_embeddings()
            else:
                print(f"[VECTOR-RAG] Loaded {self.collection.count()} block embeddings")
            
            self.initialized = True
            
        except Exception as e:
            print(f"[VECTOR-RAG] Initialization error: {e}")
            self.initialized = False
    
    def _create_embeddings(self):
        """Create embeddings for all block descriptions."""
        model = get_embedding_model()
        
        ids = []
        documents = []
        metadatas = []
        
        for block_type, description in BLOCK_DESCRIPTIONS.items():
            ids.append(block_type)
            # Create a rich text representation for the vector
            # We combine the block type and detailed description
            text_to_embed = f"{block_type}: {description}"
            documents.append(text_to_embed)
            
            # Determine category
            category = "other"
            for strategy_type, config in STRATEGY_TYPES.items():
                if block_type in config.get("indicators", []):
                    category = strategy_type.lower()
                    break
            
            metadatas.append({
                "block_type": block_type,
                "category": category,
                "raw_description": description
            })
        
        # Generate embeddings
        embeddings = model.encode(documents).tolist()
        
        # Add to collection
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
        
        print(f"[VECTOR-RAG] Created {len(ids)} block embeddings with {model}")
    
    def search_blocks(
        self, 
        query: str, 
        n_results: int = 15,
        category_filter: Optional[str] = None,
        use_reranker: bool = True
    ) -> List[Dict]:
        """
        Search for relevant blocks using semantic similarity + re-ranking.
        
        Args:
            query: User's strategy description
            n_results: Number of results to return
            category_filter: Optional category to filter by
            use_reranker: whether to use CrossEncoder to re-rank results
        
        Returns:
            List of matching blocks with scores
        """
        if not self.initialized:
            self.initialize()
        
        if not self.collection:
            return []
        
        try:
            model = get_embedding_model()
            query_embedding = model.encode([query]).tolist()
            
            # Build where filter
            where_filter = None
            if category_filter:
                where_filter = {"category": category_filter.lower()}
            
            # 1. Retrieve more candidates than we need (for high recall)
            candidate_count = n_results * 2 if use_reranker else n_results
            
            results = self.collection.query(
                query_embeddings=query_embedding,
                n_results=candidate_count,
                where=where_filter
            )
            
            # Collect candidates
            candidates = []
            if results and results['ids'] and len(results['ids']) > 0:
                for i, block_id in enumerate(results['ids'][0]):
                    candidates.append({
                        "block_type": block_id,
                        "description": results['documents'][0][i] if results['documents'] else "",
                        "distance": results['distances'][0][i] if results['distances'] else 0,
                        "metadata": results['metadatas'][0][i] if results['metadatas'] else {}
                    })
            
            if not candidates or not use_reranker:
                return candidates[:n_results]
                
            # 2. Re-rank using Cross-Encoder
            try:
                cross_encoder = get_cross_encoder()
                
                # Prepare pairs for cross-encoder (Query, Document)
                pairs = [[query, c["description"]] for c in candidates]
                scores = cross_encoder.predict(pairs)
                
                # Add scores to candidates
                for i, candidate in enumerate(candidates):
                    candidate["re_rank_score"] = float(scores[i])
                
                # Sort by re-rank score (descending)
                candidates.sort(key=lambda x: x["re_rank_score"], reverse=True)
                
                # debug print top 3
                # print(f"[VECTOR-RAG] Top 3 after re-ranking for '{query}':")
                # for c in candidates[:3]:
                #     print(f"  - {c['block_type']} ({c['re_rank_score']:.4f})")
                    
            except Exception as e:
                print(f"[VECTOR-RAG] Re-ranking failed (using raw vector order): {e}")
                
            return candidates[:n_results]
            
        except Exception as e:
            print(f"[VECTOR-RAG] Search error: {e}")
            return []

    def add_new_block_embedding(self, block_type: str, description: str, category: str = "other"):
        """Add a new block embedding to the database dynamically."""
        if not self.initialized:
            self.initialize()
            
        try:
            model = get_embedding_model()
            text_to_embed = f"{block_type}: {description}"
            embedding = model.encode([text_to_embed]).tolist()
            
            self.collection.add(
                ids=[block_type],
                documents=[text_to_embed],
                embeddings=embedding,
                metadatas=[{"block_type": block_type, "category": category, "raw_description": description}]
            )
            print(f"[VECTOR-RAG] Added new block embedding: {block_type}")
            return True
        except Exception as e:
            print(f"[VECTOR-RAG] Error adding embedding: {e}")
            return False


# ============================================================================
# TWO-STAGE RETRIEVAL
# ============================================================================

async def classify_strategy_type(query: str, call_llm=None) -> str:
    """
    Stage 1: Use LLM to classify the strategy type.
    """
    # Fallback: keyword-based classification
    query_lower = query.lower()
    
    for strategy_type, config in STRATEGY_TYPES.items():
        for keyword in config.get("keywords", []):
            if keyword in query_lower:
                print(f"[VECTOR-RAG] Classified as {strategy_type} (keyword match)")
                return strategy_type
    
    # If LLM available, use it for better classification
    if call_llm:
        try:
            prompt = CLASSIFIER_PROMPT.format(query=query)
            messages = [
                {"role": "user", "content": prompt}
            ]
            response = await call_llm(messages, temperature=0.1)
            
            # Extract strategy type from response
            response = response.strip().upper()
            for strategy_type in STRATEGY_TYPES.keys():
                if strategy_type in response:
                    print(f"[VECTOR-RAG] Classified as {strategy_type} (LLM)")
                    return strategy_type
        except Exception as e:
            print(f"[VECTOR-RAG] LLM classification failed: {e}")
    
    # Default
    print("[VECTOR-RAG] Defaulting to TREND")
    return "TREND"


def get_category_blocks(strategy_type: str) -> List[str]:
    """Get recommended blocks for a strategy type."""
    config = STRATEGY_TYPES.get(strategy_type, STRATEGY_TYPES["TREND"])
    
    # Start with category-specific indicators
    blocks = list(config.get("indicators", []))
    
    # Always include core blocks
    core_blocks = [
        "control_forever",
        "control_if",
        "environment_new_candle_open",
        "trade_order",
        "operator_greater",
        "operator_less",
        "math_number"
    ]
    
    for block in core_blocks:
        if block not in blocks:
            blocks.append(block)
    
    return blocks


async def two_stage_retrieve(
    query: str,
    block_library,  # BlockLibrary instance from rag_system.py
    vector_rag: Optional[VectorRAG] = None,
    call_llm=None,
    n_results: int = 20  # Increased for better recall before re-ranking
) -> Tuple[str, Dict[str, str]]:
    """
    Two-stage retrieval pipeline.
    
    Stage 1: Classify strategy type
    Stage 2: Retrieve relevant blocks using vector search + re-ranking
    
    Returns:
        Tuple of (strategy_type, dict of block_type -> xml_template)
    """
    # Stage 1: Classify
    strategy_type = await classify_strategy_type(query, call_llm)
    print(f"[VECTOR-RAG] Stage 1 - Strategy type: {strategy_type}")
    
    # Get category-specific blocks
    category_blocks = get_category_blocks(strategy_type)
    
    # Start with category blocks
    result_blocks = {}
    for block_type in category_blocks:
        xml = block_library.get_block_xml(block_type)
        if xml:
            result_blocks[block_type] = xml
    
    # Stage 2: Vector search for additional relevant blocks
    if vector_rag:
        # Auto-initialize if needed
        if not vector_rag.initialized:
            vector_rag.initialize()
            
        search_results = vector_rag.search_blocks(
            query=query,
            n_results=n_results,
            use_reranker=True
        )
        
        for result in search_results:
            block_type = result["block_type"]
            if block_type not in result_blocks:
                xml = block_library.get_block_xml(block_type)
                if xml:
                    result_blocks[block_type] = xml
        
        print(f"[VECTOR-RAG] Stage 2 - Retrieved {len(result_blocks)} total blocks")
    
    return strategy_type, result_blocks


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

# Lazy singleton
_vector_rag_instance = None

def get_vector_rag() -> VectorRAG:
    """Get or create VectorRAG singleton."""
    global _vector_rag_instance
    if _vector_rag_instance is None:
        # Use absolute path relative to this file to store the DB
        # This ensures we don't pollute the root directory
        base_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(base_dir, "chroma_db_v2")
        
        _vector_rag_instance = VectorRAG(
            persist_directory=db_path
        )
    return _vector_rag_instance
