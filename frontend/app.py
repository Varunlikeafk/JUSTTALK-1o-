import os
import json
import datetime
import time
import re
from zoneinfo import ZoneInfo

from flask import Flask, request, jsonify
from flask_cors import CORS
from duckduckgo_search import DDGS
from groq import Groq
import logging

import llm_reliability

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# GROQ API CLIENT INTEGRATION
# Read from the environment. Never commit the key to a public repo.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# max_retries=0: llm_reliability owns retries/backoff/fallback so they are not doubled.
groq_client = Groq(api_key=GROQ_API_KEY, max_retries=0)

MODEL_ID = "openai/gpt-oss-20b"
# Fallback models are OFF until GROQ_FALLBACK_MODELS is set (comma-separated Groq model ids).
MODELS = llm_reliability.models_from_env(MODEL_ID)
IST = ZoneInfo("Asia/Kolkata")

# ---------------------------------------------------------------------------
# PERSISTENT CREDIT SYSTEM
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDITS_FILE = os.path.join(BASE_DIR, "credits.json")


def load_credits():
    try:
        with open(CREDITS_FILE, "r") as f:
            data = json.load(f)
            return int(data.get("credits", 1000))
    except (FileNotFoundError, ValueError, json.JSONDecodeError):
        return 1000


def save_credits():
    try:
        with open(CREDITS_FILE, "w") as f:
            json.dump({"credits": SYSTEM_CREDITS}, f)
    except OSError:
        pass


SYSTEM_CREDITS = load_credits()


def adjust_credits(delta):
    global SYSTEM_CREDITS
    SYSTEM_CREDITS += delta
    save_credits()
    return SYSTEM_CREDITS


# ---------------------------------------------------------------------------
# TIME, IDENTITY AND WEB-SEARCH PATTERNS
# ---------------------------------------------------------------------------
def now_ist():
    """Current time in India (the product's audience), not the server's UTC clock."""
    return datetime.datetime.now(IST)


# Only explicit date/time questions go to the clock. Plain words like "year"
# or "today" inside other questions no longer hijack the answer.
TEMPORAL_RE = re.compile(
    r"(?i)\b(what(?:'s| is)?\s+(?:the\s+)?(?:today'?s\s+)?(?:date|time|day|year)"
    r"|today'?s date|current (?:date|time)|what day is it|what year is it"
    r"|what time is it|date today)\b"
)

IDENTITY_RE = re.compile(
    r"(?i)\b(who are you|your name|what is your name|what'?s your name"
    r"|who (?:made|created|developed|built|founded) you"
    r"|who (?:is|'s) your (?:founder|developer|creator)"
    r"|what model are you|which model are you|are you (?:gpt|chatgpt))\b"
)

WEB_CAPABILITY_RE = re.compile(
    r"(?i)\b(do you have (?:web|internet) (?:search|access)|can you search"
    r"|are you connected to the (?:internet|web)|do you (?:search|browse) the (?:web|internet))\b"
)

# Questions whose answer can change over time: these always get a fresh search.
CURRENT_INFO_RE = re.compile(
    r"(?i)\b(latest|current|currently|today|tonight|now|news|price|weather|score"
    r"|recent|this week|live|stock|rate|2025|2026)\b"
)

WEB_FILLER_RE = (
    r"(?i)\b(write|create|draft|paragraph|essay|explain|summary|summarize|"
    r"tell me|please|give me|words?|on|about|a|an|the)\b"
)


# ---------------------------------------------------------------------------
# SYSTEM PROMPT (name, founder, web search and the real date)
# ---------------------------------------------------------------------------
def build_system_prompt(strict_mode=False):
    now = now_ist()
    prompt = (
        f"Current date and time: {now.strftime('%A, %B %d, %Y, %I:%M %p')} IST (India). "
        "Treat this as the true date. Your training data may be out of date, so never "
        "state a year or 'latest' fact from memory. Use the web search results instead.\n\n"

        "Your name is Regen 1o (public release), the AI assistant of Just Talk. "
        "Regen 1o was developed by justtalk, and its founder is Varun Pant. "
        "Always introduce yourself as Regen 1o. Do not call yourself GPT, ChatGPT, "
        "OpenAI, or JUSTTALK 1.1 ALPHA. If asked what model you run on, answer honestly: "
        "Regen 1o is an alpha variant built on the open-weight openai/gpt-oss-20b model, "
        "served by Groq.\n\n"

        "You have live web search. The server searches the web for current questions and "
        "passes the results to you in the message under 'Web search results'. When those "
        "results are present, base current facts on them and name the source URL. If no "
        "results are provided, say that you are answering from your own knowledge and it "
        "may be out of date.\n\n"

        "Strictly follow any word count, length, or format constraints specified in the "
        "user's request (for example '200 words' or '3 paragraphs') and match them as "
        "closely as possible. If you do not have verified or reliable information about "
        "something, clearly say you are unsure instead of inventing facts, names, dates, "
        "or figures. When you write code or any multi-line snippet meant to be copied, "
        "always wrap it in a fenced code block with triple backticks and the language name."
    )
    if strict_mode:
        prompt += (
            " Your system credit score is currently LOW because of recent errors or "
            "unverified answers. Work extra carefully on this response: lean heavily "
            "on any web results provided, double-check every factual claim, keep the "
            "answer precise, and explicitly flag anything you are not fully certain about."
        )
    return prompt


def clean_hallucinations(text):
    text = re.sub(r'(?i)(roll\s*no|reg\s*no|id|student\s*id|registration)[:\s]*\w+', '', text)
    stop_signals = ["User:", "Assistant:", "Question:", "Answer:", "http", "www"]
    for signal in stop_signals:
        if signal in text:
            text = text.split(signal)[0].strip()
    return re.sub(r'\s+', ' ', text).strip()


def extract_clean_topic(user_input, history=None):
    filler = (
        r'(?i)\b(write|create|draft|explain|summarize|summary|paragraph|essay|notes|'
        r'article|a|an|the|on|about|for|me|in|limit|word|words|\d+|i|said|want|please|give)\b'
    )
    clean = re.sub(filler, ' ', user_input)
    clean = re.sub(r'\s+', ' ', clean).strip()

    if len(clean) < 2 and history:
        for turn in reversed(history):
            past_msg = turn.get("content", "")
            past_clean = re.sub(filler, ' ', past_msg)
            past_clean = re.sub(r'\s+', ' ', past_clean).strip()
            if len(past_clean) >= 2:
                return past_clean.upper()

    return clean.upper() if len(clean) >= 2 else user_input.upper()


# ---------------------------------------------------------------------------
# WEB SEARCH
# ---------------------------------------------------------------------------
def web_search(query, web_search_enabled=True):
    """Return (results, ok, info).

    info is the source URL on success, or a DISABLED / OFFLINE: / ERROR: prefixed
    message on failure, which the router uses to decide whether to penalise.
    """
    if not web_search_enabled:
        return None, False, "DISABLED: Web search turned off by user."

    clean_q = re.sub(WEB_FILLER_RE, " ", query)
    clean_q = re.sub(r"\s+", " ", clean_q).strip() or query

    is_current = bool(CURRENT_INFO_RE.search(query))
    if is_current:
        clean_q = f"{clean_q} {now_ist().year}"

    try:
        with DDGS() as ddgs:
            results = []
            # For time-sensitive questions, first ask for results from the last day.
            if is_current:
                results = list(ddgs.text(clean_q, max_results=4, timelimit="d"))
            # Fall back to an unrestricted search if nothing recent came back.
            if not results:
                results = list(ddgs.text(clean_q, max_results=4))

        results = [r for r in results if r.get("body")]
        if results:
            return results, True, results[0].get("href", "Web Stream")
        return None, False, "No search snippets returned."
    except Exception as e:
        err_str = str(e)
        offline_signals = ["NameResolutionError", "ConnectionError", "Max retries",
                           "Failed to establish", "Network is unreachable", "Timeout",
                           "getaddrinfo failed", "RatelimitException"]
        is_offline = any(sig.lower() in err_str.lower() for sig in offline_signals)
        prefix = "OFFLINE:" if is_offline else "ERROR:"
        return None, False, f"{prefix}{err_str}"


def web_context_block(results):
    """Format search results for the model, with the time they were fetched."""
    stamp = now_ist().strftime("%A, %B %d, %Y %I:%M %p IST")
    lines = [f"Web search results (retrieved {stamp}):"]
    for i, r in enumerate(results, 1):
        body = re.sub(r"\s+", " ", r.get("body", "")).strip()[:500]
        lines.append(f"[{i}] {r.get('title', '')} ({r.get('href', '')})\n{body}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# MODEL CALL
# ---------------------------------------------------------------------------
def generate_llama_response(prompt_text, history_list, strict_mode=False):
    try:
        messages = [{"role": "system", "content": build_system_prompt(strict_mode)}]

        for turn in history_list[-12:]:
            role = "user" if turn.get("role") == "user" else "assistant"
            content = turn.get("content", "")
            if content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": prompt_text})

        completion = llm_reliability.chat_completion(
            groq_client, MODELS, messages,
            temperature=0.6,
            max_tokens=4096,
        )
        message = completion.choices[0].message
        content = message.content
        reasoning = getattr(message, "reasoning", None) or ""

        if not content or not content.strip():
            return (
                "Model Error: Empty response — the model used its full token "
                "budget on internal reasoning and returned no visible answer. "
                "Try a shorter/simpler request.",
                False,
                reasoning,
            )

        return content.strip(), True, reasoning.strip() if reasoning else ""
    except Exception as e:
        return f"Model Error: {str(e)}", False, ""


def build_thought(base_log, reasoning):
    if reasoning:
        return f"{base_log}\n\n--- Model reasoning ---\n{reasoning}"
    return base_log


# ---------------------------------------------------------------------------
# CHAT ENDPOINT
# ---------------------------------------------------------------------------
@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
        return response, 200

    start_time = time.time()
    data = request.json or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])
    web_search_enabled = data.get("web_search_enabled", True)
    msg_lower = user_message.lower()

    if not user_message:
        return jsonify({
            "reply": "Please provide a valid text prompt.",
            "thought": "Empty query received.",
            "response_time": 0.0,
            "credits": SYSTEM_CREDITS
        })

    active_topic = extract_clean_topic(user_message, history)
    is_low_credit = SYSTEM_CREDITS < 700
    mode_prefix = "🛡️ [CAREFUL MODE: Low Credits <700] Verifying extra carefully. " if is_low_credit else ""
    searched = False  # set once a web search has run for this request

    # 1. TEMPORAL ROUTER (explicit date/time questions only)
    if TEMPORAL_RE.search(user_message):
        now = now_ist()
        current_date_str = now.strftime("%A, %B %d, %Y (%I:%M %p IST)")
        adjust_credits(50)
        return jsonify({
            "reply": f"Today's date and time is: **{current_date_str}**",
            "thought": f"🎯 SYSTEM ROUTER: Evaluated system clock (India time). +50 Credits Awarded! (Total: {SYSTEM_CREDITS})",
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 2. IDENTITY ROUTER
    if IDENTITY_RE.search(user_message):
        adjust_credits(50)
        return jsonify({
            "reply": (
                "I am Regen 1o (public release), the AI assistant of Just Talk. "
                "I was developed by justtalk, and my founder is Varun Pant. "
                "I run on an alpha variant of the open-weight openai/gpt-oss-20b model "
                "served by Groq, and I can search the web for current information."
            ),
            "thought": f"Identity query matched. +50 Credits Awarded! (Total: {SYSTEM_CREDITS})",
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 2b. WEB CAPABILITY ROUTER (answers "do you have web search?" correctly)
    if WEB_CAPABILITY_RE.search(user_message):
        if web_search_enabled:
            reply = (
                "Yes. I have live web search. For questions about current events, prices, "
                "or other things that change, the server searches the web and I answer from "
                "those results, naming the sources. The Web Search toggle in the sidebar "
                "turns it on or off."
            )
        else:
            reply = (
                "I have web search, but it is currently turned off in the sidebar, so I am "
                "answering from my own knowledge. Turn the Web Search toggle on to get live results."
            )
        return jsonify({
            "reply": reply,
            "thought": "Web capability query matched. No credits changed.",
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 3. GENERATION / TASK ROUTER
    generation_keywords = ["write", "create", "draft", "paragraph", "essay", "summary", "explain", "code", "words"]
    if any(word in msg_lower for word in generation_keywords):
        results, is_verified, audit_info = web_search(active_topic, web_search_enabled)
        searched = True

        gen_prompt = user_message
        if is_verified:
            gen_prompt += "\n\n" + web_context_block(results)

        llama_output, success, reasoning = generate_llama_response(gen_prompt, history, strict_mode=is_low_credit)

        if success:
            reward = 20 if is_low_credit else 50
            adjust_credits(reward)
            tag = "🛡️ CAREFUL MODE RECOVERY" if is_low_credit else "✅ GPT-OSS-20B GENERATION"
            thought_log = f"{tag}: Generated output for '{active_topic}'. +{reward} Credits!"
            if is_verified:
                thought_log += f" Web context attached ({audit_info})."
            elif audit_info.startswith("DISABLED"):
                thought_log += " (Web search disabled by user.)"
            elif audit_info.startswith("OFFLINE"):
                thought_log += " (Web search unreachable — no credit penalty applied.)"
            reply_text = llama_output
        else:
            adjust_credits(-100)
            reply_text = "Generation failed."
            thought_log = f"⚠️ PENALTY (-100 Credits) | Generation Error: {llama_output}"

        return jsonify({
            "reply": reply_text,
            "thought": mode_prefix + build_thought(thought_log, reasoning),
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 4. FACTUAL QUERY ROUTER
    fact_keywords = ["when", "who", "where", "what", "founded", "found", "invented", "created", "price", "born", "age", "ceo", "apple", "tesla", "company"]
    is_factual_query = any(word in msg_lower for word in fact_keywords)
    fallback_prefix = ""

    if is_factual_query:
        results, is_verified, audit_info = web_search(active_topic, web_search_enabled)
        searched = True
        if is_verified:
            adjust_credits(50)
            snippet = re.sub(r"\s+", " ", results[0].get("body", "")).strip()[:400] + "..."
            return jsonify({
                "reply": snippet,
                "thought": f"{mode_prefix}✅ WEB VERIFIED | Source: {audit_info}. +50 Credits Awarded!",
                "response_time": round(time.time() - start_time, 2),
                "credits": SYSTEM_CREDITS
            })
        if audit_info.startswith("DISABLED") or audit_info.startswith("OFFLINE"):
            reason = "disabled by user" if audit_info.startswith("DISABLED") else "web search unreachable (offline)"
            fallback_prefix = f"ℹ️ No penalty — {reason}. Falling back to model knowledge. "
        else:
            adjust_credits(-100)
            fallback_prefix = f"⚠️ PENALTY (-100 Credits) | Web Verification Failed: {audit_info}. "

    # 5. CONVERSATIONAL FALLBACK
    # Attach fresh web results whenever the question is about something that changes,
    # or when the answer has to be checked carefully (low credits).
    fallback_prompt = user_message
    if not searched and (is_low_credit or CURRENT_INFO_RE.search(user_message)):
        results, is_verified, audit_info = web_search(active_topic, web_search_enabled)
        if is_verified:
            fallback_prompt += "\n\n" + web_context_block(results)

    bot_reply, success, reasoning = generate_llama_response(fallback_prompt, history, strict_mode=is_low_credit)

    if success:
        thought_log = fallback_prefix + "Processed conversational query via GPT-OSS-20B Engine."
    else:
        adjust_credits(-100)
        thought_log = fallback_prefix + f"⚠️ PENALTY APPLIED (-100 Credits) | Model error: {bot_reply}"
        bot_reply = "I am Regen 1o. Unable to process query."

    return jsonify({
        "reply": bot_reply,
        "thought": mode_prefix + build_thought(thought_log, reasoning),
        "response_time": round(time.time() - start_time, 2),
        "credits": SYSTEM_CREDITS
    })


if __name__ == "__main__":
    app.run(port=5000, debug=False)