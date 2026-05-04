import axios from '../context/axiosConfig';

export const fetchEntertainmentHome = async () => {
  const response = await axios.get('/entertainment/home');
  return response.data.data;
};

export const fetchTrailersBatch = async (ids: number[]) => {
  const response = await axios.get('/entertainment/trailers-batch', {
    params: { ids: ids.join(',') },
  });
  return response.data.trailers;
};

export const fetchTrendingMovies = async () => {
  const response = await axios.get('/entertainment/trending');
  return response.data.results;
};

export const fetchPopularMovies = async () => {
  const response = await axios.get('/entertainment/popular');
  return response.data.results;
};

export const fetchUpcomingMovies = async () => {
  const response = await axios.get('/entertainment/upcoming');
  return response.data.results;
};

export const fetchTopRatedMovies = async () => {
  const response = await axios.get('/entertainment/top-rated');
  return response.data.results;
};

export const fetchBollywoodMovies = async () => {
  const response = await axios.get('/entertainment/bollywood');
  return response.data.results;
};

export const fetchMoviesByGenre = async (genreId: number | string) => {
  const response = await axios.get(`/entertainment/genre/${genreId}`);
  return response.data.results;
};

export const fetchMovieDetails = async (movieId: number) => {
  const response = await axios.get(`/entertainment/movie/${movieId}`);
  return response.data.movie;
};

export const searchMovies = async (query: string) => {
  const response = await axios.get('/entertainment/search', {
    params: { query },
  });
  return response.data.results;
};

export const getMovieTrailers = async (movieId: number) => {
  const response = await axios.get(`/entertainment/movie/${movieId}/trailers`);
  return response.data.results;
};

export const getImageUrl = (path: string, size: string = 'w500') => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};
