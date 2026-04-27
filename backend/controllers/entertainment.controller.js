const TMDB_BASE_URL = 'http://api.themoviedb.org/3';
const tmdbFetch = async (endpoint) => {
  const token = process.env.TMDB_ACCESS_TOKEN;
  const url = `${TMDB_BASE_URL}${endpoint}`;
  const options = {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  };
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.status_message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const getTrending = async (req, res) => {
  try {
    const data = await tmdbFetch('/trending/movie/week?language=en-US');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Trending Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch trending movies' });
  }
};

export const getPopular = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/popular?language=en-US&page=2');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Popular Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch popular movies' });
  }
};

export const getUpcoming = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/upcoming?language=en-US&page=1');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Upcoming Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming movies' });
  }
};

export const getMovieDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tmdbFetch(`/movie/${id}?append_to_response=videos,similar,recommendations&language=en-US`);
    res.status(200).json({ success: true, movie: data });
  } catch (error) {
    console.error('TMDB Movie Details Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch movie details' });
  }
};

export const searchMovies = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'Query required' });
    const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`);
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Search Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to search movies' });
  }
};

export const getBollywood = async (req, res) => {
  try {
    const data = await tmdbFetch('/discover/movie?with_original_language=hi&language=en-US&sort_by=popularity.desc&page=1');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Bollywood Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Bollywood movies' });
  }
};

export const getTopRated = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/top_rated?language=en-US&page=3');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Top Rated Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch top rated movies' });
  }
};

export const getByGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const data = await tmdbFetch(`/discover/movie?with_genres=${genreId}&language=en-US&sort_by=vote_count.desc&page=1`);
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Genre Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch movies by genre' });
  }
};

export const getMovieTrailers = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tmdbFetch(`/movie/${id}/videos?language=en-US`);
    const trailers = data.results.filter((v) => v.type === 'Trailer' && v.site === 'YouTube');
    res.status(200).json({ success: true, results: trailers });
  } catch (error) {
    console.error('TMDB Trailers Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch movie trailers' });
  }
};
