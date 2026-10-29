/* global CHAT_INTENTS */
/**
 * chat.js — "Chat with Us" rule-based clinic assistant (vanilla JS).
 *
 * How it works:
 *  1. The user presses Ctrl+Enter (or Send; Ctrl+K focuses it) to speak.
 *  2. The message is lowercased and matched against `keywords` in the
 *     intents JSON (see chat-data.js); the first matching intent wins,
 *     otherwise `fallback` replies.
 *  3. Every turn — user and bot alike — is appended to the `history` array
 *     (a plain JSON-style array, dumped to the console for inspection).
 */
(function (window, document) {
  'use strict';

  /** One JSON object per message: { from: 'user'|'bot', text, time }. */
  const history = [];

  function matchIntent(text) {
    for (const [name, intent] of Object.entries(CHAT_INTENTS)) {
      if (intent.keywords.some(kw => text.includes(kw))) {
        return { name, reply: intent.reply };
      }
    }
    return { name: 'fallback', reply: CHAT_INTENTS.fallback.reply };
  }

  function el(id) {
    return document.getElementById(id);
  }

  function addBubble(from, text) {
    const div = document.createElement('div');
    div.className = `ct-msg ${from === 'user' ? 'ct-msg-user' : 'ct-msg-bot'}`;
    div.textContent = text; // textContent, so patient text can never inject HTML
    el('chat-body').appendChild(div);
    el('chat-body').scrollTop = el('chat-body').scrollHeight;
  }

  function push(from, text, show) {
    history.push({ from, text, time: new Date().toISOString() });
    if (show) addBubble(from, text);
  }

  function respond(userText) {
    push('user', userText, true);
    setTimeout(function () {
      const { name, reply } = matchIntent(userText.toLowerCase());
      push('bot', name === 'fallback' ? CHAT_INTENTS.fallback.reply : reply, true);
      console.log('chat history so far:', history);
    }, 350); // small delay so the bot feels like it is "typing"
  }

  function open() {
    el('chat-panel').classList.remove('d-none');
    el('chat-toggle').classList.add('d-none');
    el('chat-input').focus();
  }

  function close() {
    el('chat-panel').classList.add('d-none');
    el('chat-toggle').classList.remove('d-none');
    el('chat-toggle').focus(); // keep focus visible for keyboard users
  }

  document.addEventListener('DOMContentLoaded', function () {
    const input = el('chat-input');

    el('chat-toggle').addEventListener('click', open);
    el('chat-close').addEventListener('click', close);
    el('chat-send').addEventListener('click', function () {
      const text = input.value.trim();
      if (!text) return; // never send empty messages
      input.value = '';
      respond(text);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el('chat-send').click();
      }
    });

    document.addEventListener('keydown', function (e) {
      // Global shortcuts: Ctrl+K opens the chat window from anywhere.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el('chat-panel').classList.contains('d-none') ? open() : el('chat-input').focus();
      }
    });

    push('bot', CHAT_INTENTS.greeting.reply, true); // opening message
  });
})(window, document);
