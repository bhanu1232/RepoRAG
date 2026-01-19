"""
Hybrid retrieval combining semantic search with keyword matching.
Uses Reciprocal Rank Fusion (RRF) to merge results.
"""

from typing import List, Dict, Any, Tuple
from collections import defaultdict
import math


class HybridRetriever:
    """Combines semantic and keyword-based retrieval for better accuracy."""
    
    def __init__(self):
        self.k = 60  # RRF constant (standard value)
    
    def calculate_bm25_score(self, query_terms: List[str], document: str, 
                            avg_doc_length: float, k1: float = 1.5, b: float = 0.75) -> float:
        """
        Calculate BM25 score for a document given query terms.
        
        BM25 is a ranking function used for keyword-based search.
        """
        doc_terms = document.lower().split()
        doc_length = len(doc_terms)
        
        # Term frequency in document
        term_freq = defaultdict(int)
        for term in doc_terms:
            term_freq[term] += 1
        
        score = 0.0
        for term in query_terms:
            if term in term_freq:
                tf = term_freq[term]
                # BM25 formula
                idf = 1.0  # Simplified IDF (would need corpus stats for true IDF)
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * (doc_length / avg_doc_length))
                score += idf * (numerator / denominator)
        
        return score
    
    def keyword_search(self, query: str, nodes: List[Any], top_k: int = 20) -> List[Tuple[Any, float]]:
        """
        Perform keyword-based search using BM25-like scoring.
        
        Args:
            query: Search query
            nodes: List of document nodes to search
            top_k: Number of top results to return
            
        Returns:
            List of (node, score) tuples
        """
        query_terms = [term.lower() for term in query.split() if len(term) > 2]
        
        if not query_terms or not nodes:
            return []
        
        # Calculate average document length
        avg_length = sum(len(node.text.split()) for node in nodes) / len(nodes)
        
        # Score each node
        scored_nodes = []
        for node in nodes:
            score = self.calculate_bm25_score(query_terms, node.text, avg_length)
            if score > 0:
                scored_nodes.append((node, score))
        
        # Sort by score and return top_k
        scored_nodes.sort(key=lambda x: x[1], reverse=True)
        return scored_nodes[:top_k]
    
    def reciprocal_rank_fusion(self, 
                               semantic_results: List[Tuple[Any, float]], 
                               keyword_results: List[Tuple[Any, float]],
                               semantic_weight: float = 0.7,
                               keyword_weight: float = 0.3) -> List[Tuple[Any, float]]:
        """
        Merge semantic and keyword results using Reciprocal Rank Fusion.
        
        RRF formula: score = sum(1 / (k + rank_i)) for each ranking
        """
        # Create rank maps
        node_scores = defaultdict(float)
        
        # Add semantic scores (weighted)
        for rank, (node, score) in enumerate(semantic_results, start=1):
            node_id = id(node)
            rrf_score = semantic_weight / (self.k + rank)
            node_scores[node_id] = rrf_score
        
        # Add keyword scores (weighted)
        for rank, (node, score) in enumerate(keyword_results, start=1):
            node_id = id(node)
            rrf_score = keyword_weight / (self.k + rank)
            node_scores[node_id] += rrf_score
        
        # Create node lookup
        node_lookup = {}
        for node, _ in semantic_results:
            node_lookup[id(node)] = node
        for node, _ in keyword_results:
            node_lookup[id(node)] = node
        
        # Sort by combined score
        merged = [(node_lookup[node_id], score) 
                  for node_id, score in node_scores.items()]
        merged.sort(key=lambda x: x[1], reverse=True)
        
        return merged
    
    def rerank_by_relevance(self, nodes: List[Tuple[Any, float]], 
                           query: str, intent: str) -> List[Tuple[Any, float]]:
        """
        Re-rank nodes based on additional relevance signals.
        
        Boosts scores based on:
        - File type relevance (code vs docs)
        - Metadata matches
        - Intent-specific patterns
        """
        reranked = []
        
        for node, base_score in nodes:
            boost = 1.0
            metadata = node.metadata if hasattr(node, 'metadata') else {}
            text_lower = node.text.lower()
            query_lower = query.lower()
            
            # Boost code files for implementation queries
            if intent == 'implementation':
                if metadata.get('file_category') == 'code':
                    boost *= 1.3
                # Boost if contains function/class definitions
                if 'def ' in text_lower or 'class ' in text_lower or 'function ' in text_lower:
                    boost *= 1.2
            
            # Boost docs for explanation queries
            elif intent == 'explanation':
                if metadata.get('file_category') == 'docs':
                    boost *= 1.2
            
            # Boost if query terms appear in metadata
            file_path = metadata.get('file_path', '').lower()
            if any(term in file_path for term in query_lower.split()):
                boost *= 1.15
            
            # Boost if exact query phrase appears
            if query_lower in text_lower:
                boost *= 1.25
            
            # Apply boost
            new_score = base_score * boost
            reranked.append((node, new_score))
        
        # Re-sort by boosted scores
        reranked.sort(key=lambda x: x[1], reverse=True)
        return reranked
    
    def expand_context(self, selected_nodes: List[Any], all_nodes: List[Any], 
                      expansion_size: int = 2) -> List[Any]:
        """
        Expand context by including surrounding chunks from the same file.
        
        This helps provide more complete code context.
        """
        expanded = list(selected_nodes)
        
        for node in selected_nodes:
            if not hasattr(node, 'metadata'):
                continue
            
            file_path = node.metadata.get('file_path')
            start_line = node.metadata.get('start_line')
            
            if not file_path or not start_line:
                continue
            
            # Find adjacent chunks from same file
            for other_node in all_nodes:
                if not hasattr(other_node, 'metadata'):
                    continue
                
                if other_node.metadata.get('file_path') != file_path:
                    continue
                
                other_start = other_node.metadata.get('start_line')
                if not other_start:
                    continue
                
                # Check if adjacent (within expansion_size chunks)
                if abs(other_start - start_line) <= expansion_size * 50:  # Assume ~50 lines per chunk
                    if other_node not in expanded:
                        expanded.append(other_node)
        
        return expanded
