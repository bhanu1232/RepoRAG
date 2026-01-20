"""
Advanced query processing for better RAG accuracy.
Handles query intent detection, expansion, and entity extraction.
"""

import re
from typing import Dict, List, Tuple, Optional
from enum import Enum



class QueryIntent(Enum):
    """Types of queries users might ask."""
    SUMMARY = "summary" # Just a quick summary
    QNA = "qna" # Simple question and answer
    CODING = "coding" # Writing or generating code
    EXPLANATION = "explanation"  # How does X work?
    IMPLEMENTATION = "implementation"  # Show me the code for X
    DEBUGGING = "debugging"  # Why is X failing?
    ARCHITECTURE = "architecture"  # What's the structure?
    USAGE = "usage"  # How do I use X?
    COMPARISON = "comparison"  # What's the difference between X and Y?
    GENERAL = "general"  # General questions


class QueryProcessor:
    """Processes and enhances user queries for better retrieval."""
    
    def __init__(self):
        # Common technical abbreviations and their expansions
        self.tech_expansions = {
            'api': 'API application programming interface',
            'db': 'database',
            'auth': 'authentication',
            'config': 'configuration',
            'env': 'environment',
            'repo': 'repository',
            'func': 'function',
            'var': 'variable',
            'params': 'parameters',
            'args': 'arguments',
            'async': 'asynchronous',
            'sync': 'synchronous',
            'ui': 'user interface',
            'ux': 'user experience',
            'crud': 'create read update delete',
            'http': 'HTTP hypertext transfer protocol',
            'rest': 'REST RESTful',
            'json': 'JSON',
            'jwt': 'JWT JSON web token',
            'oauth': 'OAuth authentication',
            'sql': 'SQL database query',
            'nosql': 'NoSQL database',
            'orm': 'ORM object relational mapping',
        }
        
        # Intent detection patterns
        self.intent_patterns = {
            QueryIntent.SUMMARY: [
                r'\bsummar(y|ize)\b',
                r'\bbrief\b',
                r'\boverview\b',
                r'\btl;?dr\b',
                r'\bshort\b',
                r'\bwhat\s+is\s+this\s+project\b',
            ],
            QueryIntent.QNA: [
                r'\bwhat\s+is\b',
                r'\bwho\b',
                r'\bwhen\b',
                r'\bdoes\s+it\b',
                r'\bis\s+there\b',
                r'\bcan\s+it\b',
                r'\bsimple\b',
                r'\bquick\b',
            ],
            QueryIntent.CODING: [
                r'\bwrite\b',
                r'\bgenerate\b',
                r'\bcreate\b',
                r'\bimplement\b',
                r'\brefactor\b',
                r'\boptimize\b',
                r'\bcode\s+for\b',
            ],
            QueryIntent.EXPLANATION: [
                r'\bhow\s+(does|do|is|are)\b',
                r'\bwhat\s+(is|are|does)\b',
                r'\bexplain\b',
                r'\bdescribe\b',
                r'\bwhy\s+(does|do|is|are)\b',
                r'\bcan\s+you\s+explain\b',
            ],
            QueryIntent.IMPLEMENTATION: [
                r'\bshow\s+me\b',
                r'\bfind\s+(the\s+)?(code|function|class|method)\b',
                r'\bwhere\s+is\b',
                r'\blocate\b',
                r'\bget\s+(the\s+)?(code|implementation)\b',
            ],
            QueryIntent.DEBUGGING: [
                r'\bwhy\s+(is|does|isn\'t|doesn\'t)\b',
                r'\berror\b',
                r'\bfail(ing|s|ed)?\b',
                r'\bbug\b',
                r'\bissue\b',
                r'\bproblem\b',
                r'\bnot\s+working\b',
                r'\bfix\b',
            ],
            QueryIntent.ARCHITECTURE: [
                r'\barchitecture\b',
                r'\bstructure\b',
                r'\borganization\b',
                r'\bdesign\b',
                r'\bpattern\b',
                r'\boverall\b',
                r'\bhigh[\s-]level\b',
            ],
            QueryIntent.USAGE: [
                r'\bhow\s+to\s+use\b',
                r'\bhow\s+can\s+i\b',
                r'\bexample\b',
                r'\busage\b',
                r'\btutorial\b',
            ],
            QueryIntent.COMPARISON: [
                r'\bdifference\s+between\b',
                r'\bcompare\b',
                r'\bvs\b',
                r'\bversus\b',
                r'\bor\b.*\bor\b',
            ],
        }
    
    def detect_intent(self, query: str) -> QueryIntent:
        """Detect the intent of the user's query."""
        query_lower = query.lower()
        
        # Check each intent pattern
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return intent
        
        return QueryIntent.GENERAL
    
    def extract_entities(self, query: str) -> Dict[str, List[str]]:
        """Extract code entities from the query."""
        entities = {
            'functions': [],
            'classes': [],
            'files': [],
            'variables': [],
            'keywords': []
        }
        
        # Extract function-like patterns (camelCase, snake_case with parentheses)
        func_patterns = [
            r'\b([a-z_][a-z0-9_]*)\s*\(',  # snake_case functions
            r'\b([a-z][a-zA-Z0-9]*)\s*\(',  # camelCase functions
        ]
        for pattern in func_patterns:
            matches = re.findall(pattern, query)
            entities['functions'].extend(matches)
        
        # Extract class-like patterns (PascalCase)
        class_pattern = r'\b([A-Z][a-zA-Z0-9]*)\b'
        entities['classes'] = re.findall(class_pattern, query)
        
        # Extract file patterns
        file_pattern = r'\b([a-zA-Z0-9_-]+\.[a-z]{2,4})\b'
        entities['files'] = re.findall(file_pattern, query)
        
        # Extract code-related keywords
        code_keywords = [
            'function', 'class', 'method', 'variable', 'constant',
            'module', 'package', 'import', 'export', 'return',
            'async', 'await', 'promise', 'callback', 'handler',
            'component', 'service', 'controller', 'model', 'view',
            'route', 'endpoint', 'middleware', 'hook', 'util'
        ]
        query_lower = query.lower()
        entities['keywords'] = [kw for kw in code_keywords if kw in query_lower]
        
        # Remove duplicates
        for key in entities:
            entities[key] = list(set(entities[key]))
        
        return entities
    
    def expand_query(self, query: str) -> str:
        """Expand technical abbreviations in the query."""
        expanded = query
        query_lower = query.lower()
        
        # Expand known abbreviations
        for abbr, expansion in self.tech_expansions.items():
            # Match whole words only
            pattern = r'\b' + re.escape(abbr) + r'\b'
            if re.search(pattern, query_lower, re.IGNORECASE):
                # Add expansion to the query (don't replace, just add context)
                expanded += f" {expansion}"
        
        return expanded
    
    def rewrite_query(self, query: str, intent: QueryIntent, entities: Dict[str, List[str]]) -> str:
        """Rewrite query based on intent for better retrieval."""
        rewritten = query
        
        # Add intent-specific context
        if intent == QueryIntent.IMPLEMENTATION:
            rewritten += " code implementation source"
            if entities['functions']:
                rewritten += f" function {' '.join(entities['functions'])}"
            if entities['classes']:
                rewritten += f" class {' '.join(entities['classes'])}"
        
        elif intent == QueryIntent.EXPLANATION:
            rewritten += " explanation how it works logic flow"
        
        elif intent == QueryIntent.DEBUGGING:
            rewritten += " error handling debugging troubleshooting"
        
        elif intent == QueryIntent.ARCHITECTURE:
            rewritten += " architecture structure design pattern organization"
        
        elif intent == QueryIntent.USAGE:
            rewritten += " usage example how to use tutorial"
        
        return rewritten
    
    def process(self, query: str, chat_history: Optional[List[Dict[str, str]]] = None) -> Dict:
        """
        Main processing pipeline for queries.
        
        Returns:
            Dict with processed query information
        """
        # Detect intent
        intent = self.detect_intent(query)
        
        # Extract entities
        entities = self.extract_entities(query)
        
        # Expand abbreviations
        expanded_query = self.expand_query(query)
        
        # Rewrite query for better retrieval
        rewritten_query = self.rewrite_query(expanded_query, intent, entities)
        
        # Build context from chat history
        context = ""
        if chat_history:
            # Get last 2 exchanges for context
            for msg in chat_history[-4:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if role == 'user':
                    context += f"Previous question: {content}\n"
        
        return {
            'original_query': query,
            'expanded_query': expanded_query,
            'rewritten_query': rewritten_query,
            'intent': intent,
            'entities': entities,
            'context': context,
        }
