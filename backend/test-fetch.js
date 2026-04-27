const test = async () => {
  const url = 'https://api.themoviedb.org/3/movie/popular?api_key=59d189e71eedc0448b8dc23d4f9a647e';
  console.log('Fetching:', url);
  
  try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Success! Results:', data.results?.length);
  } catch (error) {
    console.error('❌ Fetch Error:', error);
    if (error.cause) {
        console.error('Cause:', error.cause);
    }
  }
};

test();
