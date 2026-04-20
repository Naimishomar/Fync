import axios from 'axios';

async function testGetSubmission() {
    const baseUrl = 'http://3.90.62.144:2358';
    // Try to get a recent submission or just test the endpoint
    try {
        const response = await axios.get(`${baseUrl}/submissions/test-token?base64_encoded=true`);
        console.log('Get Success:', response.status);
    } catch (error) {
        console.error('Get Error Status:', error.response?.status);
        console.error('Get Error Message:', error.message);
        console.error('Get Error Code:', error.code);
    }
}

testGetSubmission();
