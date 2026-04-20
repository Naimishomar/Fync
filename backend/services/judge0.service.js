import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Service to interact with Judge0 (via RapidAPI) for code execution and evaluation.
 * Pivot: Migrated from self-hosted to Pay-Per-Use model.
 */
class Judge0Service {
  constructor() {
    this.baseUrl = process.env.JUDGE0_URL || 'http://localhost:2358';
    this.rapidApiKey = process.env.RAPIDAPI_KEY;
    this.rapidApiHost = process.env.RAPIDAPI_HOST;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.rapidApiKey) {
      headers['x-rapidapi-key'] = this.rapidApiKey;
    }
    if (this.rapidApiHost) {
      headers['x-rapidapi-host'] = this.rapidApiHost;
    }
    return headers;
  }

  /**
   * Submit code for execution via Self-Hosted Judge0
   * @param {string} sourceCode - The code to execute
   * @param {number} languageId - Judge0 language ID
   * @param {string} stdin - Input for the program
   * @param {string} expectedOutput - Expected output for validation
   */
  async submitCode(sourceCode, languageId, stdin = '', expectedOutput = '') {
    try {
      const response = await axios.post(`${this.baseUrl}/submissions?base64_encoded=true&wait=false`, {
        source_code: Buffer.from(sourceCode).toString('base64'),
        language_id: languageId,
        stdin: Buffer.from(stdin).toString('base64'),
        expected_output: expectedOutput ? Buffer.from(expectedOutput).toString('base64') : null,
      }, {
        headers: this.getHeaders(),
        timeout: 10000 // 10s defensive timeout
      });

      return response.data.token;
    } catch (error) {
      console.error('Judge0 Submission Error:', error.response?.data || error.message);
      throw new Error('Failed to submit code to Judge0');
    }
  }

  /**
   * Get submission status/result by token via Self-Hosted Judge0
   * @param {string} token - Judge0 submission token
   */
  async getSubmission(token) {
    try {
      const response = await axios.get(`${this.baseUrl}/submissions/${token}?base64_encoded=true`, {
        headers: this.getHeaders(),
        timeout: 10000 // 10s defensive timeout
      });

      const data = response.data;
      
      return {
        status: data.status,
        stdout: data.stdout ? Buffer.from(data.stdout, 'base64').toString() : null,
        stderr: data.stderr ? Buffer.from(data.stderr, 'base64').toString() : null,
        compile_output: data.compile_output ? Buffer.from(data.compile_output, 'base64').toString() : null,
        time: data.time ? parseFloat(data.time) : 0,
        memory: data.memory ? parseFloat(data.memory) : 0,
        message: data.message
      };
    } catch (error) {
      console.error('Judge0 Get Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch submission from Judge0');
    }
  }

  /**
   * Map status IDs to human readable labels
   */
  getStatusLabel(statusId) {
    const statusMap = {
      1: 'In Queue',
      2: 'Processing',
      3: 'Accepted',
      4: 'Wrong Answer',
      5: 'Time Limit Exceeded',
      6: 'Compilation Error',
      7: 'Runtime Error (SIGPFE)',
      8: 'Runtime Error (SIGSEGV)',
      9: 'Runtime Error (SIGXFSZ)',
      10: 'Runtime Error (SIGFPE)',
      11: 'Runtime Error (SIGABRT)',
      12: 'Runtime Error (NZEC)',
      13: 'Internal Error',
      14: 'Exec Format Error'
    };
    return statusMap[statusId] || 'Unknown Error';
  }
}

export default new Judge0Service();
