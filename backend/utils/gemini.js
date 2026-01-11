import { GoogleGenAI } from "@google/genai";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FALLBACK_QUESTIONS = [
  {
    "question": "What is the output of `typeof null` in JavaScript?",
    "options": ["null", "object", "undefined", "number"],
    "correctAnswer": 1
  },
  {
    "question": "Which HTTP status code represents 'Not Found'?",
    "options": ["200", "500", "404", "403"],
    "correctAnswer": 2
  },
  {
    "question": "Which React hook is used to handle side effects?",
    "options": ["useState", "useReducer", "useEffect", "useContext"],
    "correctAnswer": 2
  },
  {
    "question": "In MongoDB, what is the equivalent of a SQL 'Row'?",
    "options": ["Collection", "Document", "Table", "Field"],
    "correctAnswer": 1
  },
  {
    "question": "What is the time complexity of Binary Search?",
    "options": ["O(n)", "O(n^2)", "O(log n)", "O(1)"],
    "correctAnswer": 2
  },
  {
    "question": "Which method removes the LAST element from an array?",
    "options": ["shift()", "unshift()", "pop()", "push()"],
    "correctAnswer": 2
  },
  {
    "question": "What does CSS stand for?",
    "options": ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style Sheets", "Colorful Style Sheets"],
    "correctAnswer": 1
  },
  {
    "question": "In Node.js, which module system is used by default (require)?",
    "options": ["ES Modules", "CommonJS", "AMD", "UMD"],
    "correctAnswer": 1
  },
  {
    "question": "What is the result of `3 + '3'` in JavaScript?",
    "options": ["6", "33", "NaN", "Error"],
    "correctAnswer": 1
  },
  {
    "question": "Which command initializes a new Git repository?",
    "options": ["git push", "git commit", "git add", "git init"],
    "correctAnswer": 3
  }
]

export const generateQuestions = async (domain) => {
    try {
        const response = await genAI.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `
            Generate 10 multiple choice questions for "${domain}".
            Difficulty: Medium/Hard.
            Everytime you generate a new question. I don't want to see the same question twice. And the question you asked will never repeat in another session also.
            CRITICAL FORMATTING RULES:
                1. Return ONLY a raw JSON array. Do not include markdown formatting like \`\`\`json or \`\`\`.
                2. The format must be exactly:
                [
                    {
                    "question": "Question text here",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": 0 // Index of the correct option (0-3)
                    }
                ]
            `
        })
        console.log(response.text);
        const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);   
    } catch (error) {
        console.error("AI Generation Error:", error);
        return FALLBACK_QUESTIONS;
    }
};