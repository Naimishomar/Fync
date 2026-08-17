// Was http:// — the bearer token travelled unencrypted and anyone on the
// network path could read it straight out of the Authorization header.
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
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
  // A DNS failure, a refused connection or the timeout above all reject here,
  // before the response is ever inspected — so they need the same upstream tag
  // as a non-2xx reply, otherwise TMDB being down reports as our 500.
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  } catch (cause) {
    const err = new Error(`TMDB unreachable: ${cause.message}`);
    err.upstream = true;
    throw err;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.status_message || `TMDB responded ${response.status}`);
    err.upstream = true;
    throw err;
  }
  return response.json();
};

export const getTrending = async (req, res) => {
  try {
    const data = await tmdbFetch('/trending/movie/week?language=en-US');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Trending Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch trending movies' });
  }
};

export const getPopular = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/popular?language=en-US&page=2');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Popular Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch popular movies' });
  }
};

export const getUpcoming = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/upcoming?language=en-US&page=1');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Upcoming Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch upcoming movies' });
  }
};

export const getMovieDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tmdbFetch(`/movie/${id}?append_to_response=videos,similar,recommendations&language=en-US`);
    res.status(200).json({ success: true, movie: data });
  } catch (error) {
    console.error('TMDB Movie Details Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch movie details' });
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
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to search movies' });
  }
};

export const getBollywood = async (req, res) => {
  try {
    const data = await tmdbFetch('/discover/movie?with_original_language=hi&language=en-US&sort_by=popularity.desc&page=1');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Bollywood Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch Bollywood movies' });
  }
};

export const getTopRated = async (req, res) => {
  try {
    const data = await tmdbFetch('/movie/top_rated?language=en-US&page=3');
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Top Rated Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch top rated movies' });
  }
};

export const getByGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const data = await tmdbFetch(`/discover/movie?with_genres=${genreId}&language=en-US&sort_by=vote_count.desc&page=1`);
    res.status(200).json({ success: true, results: data.results });
  } catch (error) {
    console.error('TMDB Genre Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch movies by genre' });
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
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch movie trailers' });
  }
};

export const getEntertainmentHome = async (req, res) => {
  try {
    const [
      trending,
      popular,
      upcoming,
      bollywood,
      topRated,
      action,
      horror
    ] = await Promise.all([
      tmdbFetch('/trending/movie/week?language=en-US'),
      tmdbFetch('/movie/popular?language=en-US&page=2'),
      tmdbFetch('/movie/upcoming?language=en-US&page=1'),
      tmdbFetch('/discover/movie?with_original_language=hi&language=en-US&sort_by=popularity.desc&page=1'),
      tmdbFetch('/movie/top_rated?language=en-US&page=3'),
      tmdbFetch('/discover/movie?with_genres=28&language=en-US&sort_by=vote_count.desc&page=1'),
      tmdbFetch('/discover/movie?with_genres=27&language=en-US&sort_by=vote_count.desc&page=1')
    ]);

    res.status(200).json({
      success: true,
      data: {
        trending: trending.results,
        popular: popular.results,
        upcoming: upcoming.results,
        bollywood: bollywood.results,
        topRated: topRated.results,
        action: action.results,
        horror: horror.results
      }
    });
  } catch (error) {
    console.error('TMDB Entertainment Home Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch entertainment home data' });
  }
};

export const getTrailersBatch = async (req, res) => {
  try {
    const { ids } = req.query; // Comma separated IDs
    if (!ids) return res.status(400).json({ success: false, message: 'IDs required' });
    
    const idArray = ids.split(',').slice(0, 15); // Limit to 15 for safety
    
    const trailerData = await Promise.all(idArray.map(async (id) => {
      try {
        const data = await tmdbFetch(`/movie/${id}/videos?language=en-US`);
        const trailer = data.results.find((v) => v.type === 'Trailer' && v.site === 'YouTube');
        return { id, key: trailer ? trailer.key : null };
      } catch (e) {
        return { id, key: null };
      }
    }));

    const trailerMap = {};
    trailerData.forEach(item => {
      trailerMap[item.id] = item.key;
    });

    res.status(200).json({ success: true, trailers: trailerMap });
  } catch (error) {
    console.error('TMDB Trailers Batch Error:', error.message);
    res.status(error?.upstream ? 502 : 500).json({ success: false, message: 'Failed to fetch trailers batch' });
  }
};
