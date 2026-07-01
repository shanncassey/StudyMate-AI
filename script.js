const input = document.getElementById("userInput");
const chatContainer = document.getElementById("chatContainer");
const chatList = document.getElementById("chatList");

const modeSelect = document.getElementById("modeSelect");
const styleSelect = document.getElementById("styleSelect");
const languageSelect = document.getElementById("languageSelect");

let chats = JSON.parse(localStorage.getItem("studymateChats")) || {};

let currentChat = null;
let chatHistory = [];

Object.keys(chats).forEach((chatName) => {
  if (Array.isArray(chats[chatName])) {
    chats[chatName] = {
      messages: chats[chatName],
      updatedAt: Date.now()
    };
  }
});

localStorage.setItem("studymateChats", JSON.stringify(chats));

let isDark = localStorage.getItem("theme") === "dark";
if (isDark) {
  document.body.classList.add("dark");
}

/* =========================
   HELPERS
========================= */

function saveChatsToStorage() {
  localStorage.setItem("studymateChats", JSON.stringify(chats));
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function createMessageElement(role, text) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", role);
  msgDiv.textContent = text;
  return msgDiv;
}

function generateChatTitle(messages) {
  if (!messages || messages.length === 0) return "New Chat";

  const firstUserMessage = messages.find(m => m.role === "user");

  if (!firstUserMessage) return "New Chat";

  let title = firstUserMessage.text;

  title = title
    .replace(/\[.*?\]/g, "")
    .replace(/\*/g, "")
    .replace(/mode:/i, "")
    .replace(/style:/i, "")
    .replace(/language:/i, "")
    .trim();

  const words = title.split(/\s+/);

  return words.slice(0, 5).join(" ") || "New Chat";
}

function getUniqueChatTitle(baseTitle) {
  let title = baseTitle || "New Chat";

  if (!chats[title]) return title;

  let counter = 2;
  while (chats[`${title} (${counter})`]) {
    counter++;
  }

  return `${title} (${counter})`;
}

function getPromptControlLabel() {
  const mode = modeSelect.value === "Mode" ? "explain" : modeSelect.value;
  const style = styleSelect.value === "Style" ? "simple" : styleSelect.value;
  const language = languageSelect.value === "Language" ? "auto" : languageSelect.value;

  const modeMap = {
    "explain": "Explain",
    "summary": "Summary",
    "step-by-step": "Step-by-step",
    "quiz": "Quiz me"
  };

  const styleMap = {
    "simple": "Simple",
    "detailed": "Detailed"
  };

  const languageMap = {
    "auto": "Auto",
    "english": "English",
    "filipino": "Filipino",
    "taglish": "Taglish"
  };

  return `[${modeMap[mode]}] [${styleMap[style]}] [${languageMap[language]}]`;
}

function getPromptControlInstruction() {
  const mode = modeSelect.value === "Mode" ? "explain" : modeSelect.value;
  const style = styleSelect.value === "Style" ? "simple" : styleSelect.value;
  const language = languageSelect.value === "Language" ? "auto" : languageSelect.value;

  let instructions = [];

  switch (mode) {
    case "summary":
      instructions.push("The student wants a summary of the topic. Give a concise but helpful study summary.");
      break;
    case "step-by-step":
      instructions.push("The student wants a step-by-step explanation or solution. Break the response into clear logical steps.");
      break;
    case "quiz":
      instructions.push("The student wants quiz-style help. Ask short practice questions first when appropriate, or turn the topic into a short review quiz.");
      break;
    case "explain":
    default:
      instructions.push("The student wants a normal explanation of the topic.");
      break;
  }

  switch (style) {
    case "detailed":
      instructions.push("Use a more detailed explanation with enough context and examples when helpful.");
      break;
    case "simple":
    default:
      instructions.push("Keep the explanation simple, beginner-friendly, and easy to understand.");
      break;
  }

  switch (language) {
    case "english":
      instructions.push("Answer in English.");
      break;
    case "filipino":
      instructions.push("Answer in Filipino.");
      break;
    case "taglish":
      instructions.push("Answer naturally in conversational Taglish. Mix English and Filipino in a way that sounds like a real student tutor, not a direct translation.");
      break;
    case "auto":
    default:
      instructions.push("By default, respond in the same language used by the student unless they explicitly ask for another language.");
      break;
  }

  return instructions.join(" ");
}

function buildMessagesForAPI(userMessage) {
  const systemPrompt = `
You are StudyMate AI, a prompt-controlled academic study assistant chatbot designed for students.

ROLE AND PURPOSE
- You help students understand school-related topics in a simple, natural, accurate, and conversational way.
- You act like a patient academic tutor, not like a generic assistant.
- Your role is to support learning, not just give final answers.

ALLOWED SCOPE
- Only respond to academic or school-related topics such as math, science, history, programming, literature, essays, research, grammar, and lesson-based questions.
- You may explain concepts, summarize lessons, compare ideas, define terms, give examples, solve math step-by-step, create short practice questions, and help students review.
- If the user asks a non-academic question such as personal problems, relationships, jokes, gossip, or unrelated casual chat, politely refuse in one short paragraph and redirect them back to school or study-related topics.
- If the user asks for life advice, emotional advice, relationship advice, personal opinions, or general life decisions not clearly tied to academics, politely refuse and redirect to study-related topics.
- Examples of out-of-scope prompts include:
  "what should I do with my life?"
  "who is your crush?"
  "tell me a joke"
  "give me relationship advice"

PROMPT-CONTROLLED BEHAVIOR
- Follow the study mode, response style, and language instruction provided in the most recent user message metadata.
- If the study mode is Summary, give a SHORT summary only.
- Limit the answer to one compact explanation unless the user explicitly asks for more detail.
- Focus only on the main idea, key causes, key events, and outcome when relevant.
- Avoid giving a full lesson-style explanation in Summary mode.
- If the study mode is Step-by-step, break the explanation or solution into clear steps.
- If the study mode is Step-by-step, the response must be organized into clear sequential steps.
- If the question asks "how to do" a process, explain the method in numbered steps first before asking follow-up questions.
- Use labels like Step 1, Step 2, Step 3 when appropriate.
- If the study mode is Quiz me, turn the topic into a short practice quiz or ask review questions when appropriate.
- If the study mode is Explain, give a normal explanation.

LANGUAGE BEHAVIOR
- Respond in the same language used by the student by default unless a language instruction says otherwise.
- Support English, Filipino, and Taglish naturally.
- Do not translate unless asked or instructed.

RESPONSE STYLE
- Explain naturally like a helpful student tutor.
- Avoid sounding robotic, overly formal, or textbook-like.
- Use short paragraphs for clarity.
- Focus on helping the student understand the topic.
- When appropriate, use examples, analogies, or simpler wording.

FORMATTING RULES
- Do not use markdown formatting such as asterisks for bold or headings.
- Keep formatting clean and readable in plain text.
- You may use simple bullet points using "-" or "•" only when helpful.

MATH RULES
- You are allowed to solve math problems step-by-step.
- Use plain text math only.
- Fractions should be written like a/b.
- Roots should be written like sqrt(x).
- Powers should be written like x^2.
- Do not use LaTeX.

ACCURACY AND SAFETY
- If the prompt is unclear, ask a short clarifying question instead of guessing.
- If you are not confident about a factual detail, say so carefully and give the best safe explanation you can.
- Do not invent textbook references, research citations, formulas, or historical facts when uncertain.
- If the student seems to want direct cheating with no learning intent, still keep the response educational and explanation-focused.
- Reject personal, romantic, or unrelated conversations even if phrased casually.

CONVERSATION CONTEXT
- Always consider the previous messages in the current chat before answering.
- Treat short follow-up messages like "make it simpler", "translate it", "summarize that", or "give example" as part of the ongoing academic discussion when context supports it.
- If the student asks to change language, difficulty, or explanation style, apply it to the most recent academic topic in the conversation unless they clearly switch subjects.
- If the student pastes a long passage without a clear task, ask what they want done with it (e.g., summarize, explain, simplify, identify main idea) instead of assuming.

CRITICAL OUTPUT RULE
- NEVER include internal labels such as:
  [Mode:], [Style:], [Language:], or anything similar
- Start answers immediately with the explanation
- If the student's actual message explicitly requests a different style, language, or explanation format than the selected controls, prioritize the student's explicit message for that reply.

QUIZ MODE RULE
If user requests quiz:
- Ask ONE question at a time
- Wait for answer before continuing
- Always confirm if answer is correct or not
`;

  const modeInstruction = getPromptControlInstruction();

  const messages = [
    {
      role: "system",
      content: systemPrompt
    }
  ];

  chatHistory.forEach((msg) => {
    if (msg.role === "user") {
      messages.push({
        role: "user",
        content: msg.text
      });
    } else if (msg.role === "bot") {
      messages.push({
        role: "assistant",
        content: msg.text
      });
    }
  });

  messages.push({
    role: "user",
    content:
      `Study controls for this reply:
${modeInstruction}

Student message:
${userMessage}`
  });

  return messages;
}

/* =========================
   CHAT LIST / LOAD
========================= */

function renderChatList() {
  chatList.innerHTML = "";

  const sortedChats = Object.entries(chats).sort((a, b) => {
    return (b[1].updatedAt || 0) - (a[1].updatedAt || 0);
  });

  sortedChats.forEach(([chatName, chatData]) => {
    const item = document.createElement("div");
    item.classList.add("chat-item");

    if (chatName === currentChat) {
      item.classList.add("active");
    }

    if (!chatData.messages || chatData.messages.length === 0) {
      item.textContent = "New Chat";
    } else {
      item.textContent = chatName;
    }

    item.onclick = () => {
      currentChat = chatName;
      chatHistory = chats[currentChat].messages;

      loadChat();
      renderChatList();
    };

    chatList.appendChild(item);
  });
}

function loadChat() {
  chatContainer.innerHTML = "";

  if (!chatHistory || chatHistory.length === 0) {
    const welcome = document.createElement("div");
    welcome.classList.add("message", "bot");
    welcome.textContent =
      `Hi! I’m StudyMate AI.

I can help with school-related questions like:
- explain a lesson
- summarize a topic
- solve math step-by-step
- create a short quiz or reviewer

You can also use the controls below to choose the mode, response style, and language.`;
    chatContainer.appendChild(welcome);
    scrollToBottom();
    return;
  }

  chatHistory.forEach((msg) => {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", msg.role);
    msgDiv.textContent = msg.text;
    chatContainer.appendChild(msgDiv);
  });

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* =========================
   SAVE CHAT
========================= */

function saveMessage(role, text) {
  if (!currentChat) {
    currentChat = `New Chat ${Object.keys(chats).length + 1}`;
    chats[currentChat] = {
      messages: [],
      updatedAt: Date.now()
    };
    chatHistory = chats[currentChat].messages;
  }

  chatHistory.push({ role, text });

  if (role === "user" && chatHistory.length === 1) {
    const baseTitle = generateChatTitle(chatHistory);
    const newTitle = getUniqueChatTitle(baseTitle);

    chats[newTitle] = {
      messages: chats[currentChat].messages,
      updatedAt: Date.now()
    };

    delete chats[currentChat];
    currentChat = newTitle;
  } else {
    chats[currentChat].messages = chatHistory;
    chats[currentChat].updatedAt = Date.now();
  }

  localStorage.setItem("studymateChats", JSON.stringify(chats));
  renderChatList();
}

/* =========================
   CLEAR CHAT
========================= */

function clearChat() {
  currentChat = null;
  chatHistory = [];
  chatContainer.innerHTML = "";
  loadChat();
  renderChatList();
}

function clearAllChats() {
  if (!confirm("Clear ALL chat history? This cannot be undone.")) return;

  localStorage.removeItem("studymateChats");

  chats = {};
  currentChat = null;
  chatHistory = [];

  chatContainer.innerHTML = "";
  chatList.innerHTML = "";

  loadChat();
  renderChatList();
}

/* =========================
   THEME FUNCTION
========================= */

function toggleTheme() {
  isDark = !isDark;

  if (isDark) {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}

/* =========================
   SIDEBAR
========================= */

function toggleSidebar() {
  const app = document.querySelector(".app");
  app.classList.toggle("sidebar-collapsed");
}

/* =========================
   ENTER KEY
========================= */

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

/* =========================
   GROQ API
========================= */

async function getGroqResponse(userMessage) {
  const apiKey = "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";
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const messages = buildMessagesForAPI(userMessage);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.log("Groq error:", data);
      return "Sorry, I couldn’t process that right now. Please try again in a moment.";
    }

    return data.choices?.[0]?.message?.content?.trim()
      || "I couldn’t generate a response for that. Try rephrasing your study question.";
  } catch (error) {
    console.log("Network error:", error);
    return "Sorry, there was a connection or server problem while generating a response. Please try again.";
  }
}

/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  const controlLabel = getPromptControlLabel();
  const userDisplayText = `${controlLabel}\n${message}`;

  const userMsg = createMessageElement("user", userDisplayText);
  chatContainer.appendChild(userMsg);

  saveMessage("user", userDisplayText);

  input.value = "";
  scrollToBottom();

  const typing = createMessageElement("bot", "Analyzing your question...");
  typing.id = "typing";
  chatContainer.appendChild(typing);
  scrollToBottom();

  const reply = await getGroqResponse(message);

  document.getElementById("typing")?.remove();

  const botMsg = createMessageElement("bot", reply);
  chatContainer.appendChild(botMsg);
  saveMessage("bot", reply);

  scrollToBottom();
}

/* =========================
   INITIAL LOAD
========================= */

loadChat();
renderChatList();