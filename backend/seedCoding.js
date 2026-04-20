import mongoose from 'mongoose';
import Problem from './models/coding/problem.model.js';
import dotenv from 'dotenv';
dotenv.config();

const problems = [
  {
    title: "Reverse a String",
    description: "Write a function that reverses a string. The input string is given as an array of characters s.",
    difficulty: "Easy",
    testCases: [
      { input: '["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]' },
      { input: '["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]' }
    ],
    starterCode: {
      javascript: "/**\n * @param {character[]} s\n * @return {void} Do not return anything, modify s in-place instead.\n */\nvar reverseString = function(s) {\n    \n};",
      cpp: "#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        \n    }\n};\n\nint main() {\n    // Standard I/O or test cases can be added here\n    return 0;\n}"
    }
  },
  {
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    difficulty: "Easy",
    testCases: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1" },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2" }
    ],
    starterCode: {
      javascript: "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};",
      cpp: "#include <iostream>\n#include <vector>\n#include <map>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};\n\nint main() {\n    // Standard I/O or test cases can be added here\n    return 0;\n}"
    }
  }
];

const seedProblems = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Problem.deleteMany({});
    await Problem.insertMany(problems);
    console.log("Problems Seeded! ✅");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedProblems();
