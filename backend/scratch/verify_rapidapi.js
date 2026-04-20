import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function verifyRapidAPI() {
    const baseUrl = process.env.JUDGE0_URL;
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST;

    console.log('Testing RapidAPI Integration...');
    console.log('URL:', baseUrl);
    console.log('Host:', apiHost);
    console.log('Key Present:', apiKey ? 'YES' : 'NO');

    if (!apiKey || apiKey === 'YOUR_RAPIDAPI_KEY_HERE') {
        console.error('Error: RAPIDAPI_KEY is missing or not updated in .env');
        return;
    }

    try {
        const response = await axios.get(`${baseUrl}/about`, {
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost
            }
        });
        console.log('SUCCESS: Connected to Judge0 via RapidAPI');
        console.log('Version:', response.data.version);
    } catch (error) {
        console.error('FAILURE: Could not connect to RapidAPI');
        console.error('Error Status:', error.response?.status);
        console.error('Error Message:', error.response?.data?.message || error.message);
    }
}

verifyRapidAPI();
