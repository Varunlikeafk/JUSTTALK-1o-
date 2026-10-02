import os
import json
import datetime
import time
import re

from flask import Flask, request, jsonify
from flask_cors import CORS
from duckduckgo_search import DDGS
from groq import Groq

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# GROQ API CLIENT INTEGRATION
# Hardcoded for local testing. Do NOT push this file to a public GitHub repo
# or share it anywhere with this key still in it — rotate the key on
# console.groq.com if that ever happens.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

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


BASE_SYSTEM_PROMPT = (
    "You are JUSTTALK 1.1 ALPHA, an intelligent AI assistant. "
    "Strictly follow any word count, length, or format constraints specified in the "
    "user's request (for example '200 words' or '3 paragraphs') and match them as "
    "closely as possible. If you do not have verified or reliable information about "
    "something, clearly say you are unsure instead of inventing facts, names, dates, "
    "or figures. When you write code or any multi-line snippet meant to be copied, "
    "always wrap it in a fenced code block with triple backticks and the language name."
)

STRICT_MODE_ADDENDUM = (
    " Your system credit score is currently LOW because of recent errors or "
    "unverified answers. Work extra carefully on this response: lean heavily "
    "on any web context provided below, double-check every factual claim, "
    "keep the answer precise, and explicitly flag anything you are not fully "
    "certain about instead of guessing."
)


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


# BUG FIX: "is offline" detection for the web-search step.
# Previously ANY failure (including the user simply switching web search
# off, or DNS/connection errors when the box has no internet) was treated
# the same as "verification failed" and cost -100 credits. Now we tell
# apart three cases: disabled-by-user, genuinely offline/network-down, and
# an actual empty-result search — only the last one is still penalised
# later in chat().
def force_google_scrape(query):
    try:
        clean_q = re.sub(r'(?i)(write|create|draft|paragraph|essay|on|about|a|an|the|words|word)', '', query).strip()
        if not clean_q:
            clean_q = query

        with DDGS() as ddgs:
            results = list(ddgs.text(clean_q, max_results=2))

        if results:
            snippet = " ".join([r.get('body', '') for r in results if r.get('body')])
            source_url = results[0].get('href', 'Web Stream')
            if snippet:
                clean_text = re.sub(r'\s+', ' ', snippet).strip()
                return clean_text[:400] + "...", True, source_url

        return None, False, "No search snippets returned."
    except Exception as e:
        err_str = str(e)
        offline_signals = ["NameResolutionError", "ConnectionError", "Max retries",
                            "Failed to establish", "Network is unreachable", "Timeout",
                            "getaddrinfo failed", "RatelimitException"]
        is_offline = any(sig.lower() in err_str.lower() for sig in offline_signals)
        prefix = "OFFLINE:" if is_offline else "ERROR:"
        return None, False, f"{prefix}{err_str}"


def maybe_scrape(topic, web_search_enabled):
    if not web_search_enabled:
        return None, False, "DISABLED: Web search turned off by user."
    return force_google_scrape(topic)


def generate_llama_response(prompt_text, history_list, strict_mode=False):
    try:
        system_content = BASE_SYSTEM_PROMPT + (STRICT_MODE_ADDENDUM if strict_mode else "")
        messages = [{"role": "system", "content": system_content}]

        # BUG FIX: history window bumped from 6 -> 12 turns so the model
        # actually remembers more of the conversation (this is what most of
        # the "history isn't working" reports were about — the model simply
        # wasn't being shown enough of the past turns to stay coherent).
        for turn in history_list[-12:]:
            role = "user" if turn.get("role") == "user" else "assistant"
            content = turn.get("content", "")
            if content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": prompt_text})

        # BUG FIX: reasoning_format was "hidden", which throws the model's
        # actual reasoning away entirely — the UI's "Thinking Process" box
        # was only ever showing our own hand-written log lines, never the
        # model's real chain of thought. Switched to "parsed" so the raw
        # reasoning comes back in its own field and we can surface it.
        completion = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=messages,
            temperature=0.6,
            max_tokens=4096,
            reasoning_effort="low",
            reasoning_format="parsed",
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
    """Append the model's real reasoning (if any) under the routing log line,
    so the frontend 'thinking' box shows the full trace instead of just the
    one-line router summary."""
    if reasoning:
        return f"{base_log}\n\n--- Model reasoning ---\n{reasoning}"
    return base_log


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

    # 1. TEMPORAL ROUTER
    time_keywords = ["date", "today", "time", "day is it", "current date", "year"]
    if any(word in msg_lower for word in time_keywords):
        now = datetime.datetime.now()
        current_date_str = now.strftime("%A, %B %d, %Y (%I:%M %p)")
        adjust_credits(50)
        return jsonify({
            "reply": f"Today's date and time is: **{current_date_str}**",
            "thought": f"🎯 SYSTEM ROUTER: Evaluated system clock. +50 Credits Awarded! (Total: {SYSTEM_CREDITS})",
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 2. IDENTITY ROUTER
    if any(q in msg_lower for q in ["who are you", "your name", "what is your name"]):
        adjust_credits(50)
        return jsonify({
            "reply": "I am JUSTTALK 1.1 ALPHA, powered by GPT-OSS-20B (via Groq) with real-time web verification.",
            "thought": f"Identity query matched. +50 Credits Awarded! (Total: {SYSTEM_CREDITS})",
            "response_time": round(time.time() - start_time, 2),
            "credits": SYSTEM_CREDITS
        })

    # 3. GENERATION / TASK ROUTER
    generation_keywords = ["write", "create", "draft", "paragraph", "essay", "summary", "explain", "code", "words"]
    if any(word in msg_lower for word in generation_keywords):
        scraped_text, is_verified, audit_info = maybe_scrape(active_topic, web_search_enabled)

        gen_prompt = user_message
        if is_verified and scraped_text:
            gen_prompt += f"\n\nContext reference from web search: {scraped_text}"

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
        scraped_text, is_verified, audit_info = maybe_scrape(active_topic, web_search_enabled)
        if is_verified and scraped_text:
            adjust_credits(50)
            return jsonify({
                "reply": scraped_text,
                "thought": f"{mode_prefix}✅ WEB VERIFIED | Source: {audit_info}. +50 Credits Awarded!",
                "response_time": round(time.time() - start_time, 2),
                "credits": SYSTEM_CREDITS
            })
        else:
            # BUG FIX: only deduct credits for a genuine verification failure.
            # If the user turned web search off, or the search backend is
            # simply unreachable (offline), that isn't the model's fault, so
            # no penalty is applied in either of those two cases anymore.
            if audit_info.startswith("DISABLED") or audit_info.startswith("OFFLINE"):
                reason = "disabled by user" if audit_info.startswith("DISABLED") else "web search unreachable (offline)"
                fallback_prefix = f"ℹ️ No penalty — {reason}. Falling back to model knowledge. "
            else:
                adjust_credits(-100)
                fallback_prefix = f"⚠️ PENALTY (-100 Credits) | Web Verification Failed: {audit_info}. "

    # 5. CONVERSATIONAL FALLBACK
    fallback_prompt = user_message
    if is_low_credit:
        scraped_text, is_verified, audit_info = maybe_scrape(active_topic, web_search_enabled)
        if is_verified and scraped_text:
            fallback_prompt += f"\n\nContext reference from web search: {scraped_text}"

    bot_reply, success, reasoning = generate_llama_response(fallback_prompt, history, strict_mode=is_low_credit)

    if success:
        thought_log = fallback_prefix + "Processed conversational query via GPT-OSS-20B Engine."
    else:
        adjust_credits(-100)
        thought_log = fallback_prefix + f"⚠️ PENALTY APPLIED (-100 Credits) | Model error: {bot_reply}"
        bot_reply = "I am JUSTTALK 1.1 ALPHA. Unable to process query."

    return jsonify({
        "reply": bot_reply,
        "thought": mode_prefix + build_thought(thought_log, reasoning),
        "response_time": round(time.time() - start_time, 2),
        "credits": SYSTEM_CREDITS
    })


if __name__ == "__main__":
    app.run(port=5000, debug=False)
