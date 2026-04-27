import express from 'express';
const router = express.Router();
import { 
  getTrending, 
  getPopular, 
  getUpcoming, 
  getTopRated,
  getBollywood,
  getByGenre,
  getMovieDetails, 
  searchMovies, 
  getMovieTrailers 
} from '../controllers/entertainment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

router.get('/trending', authMiddleware, getTrending);
router.get('/popular', authMiddleware, getPopular);
router.get('/upcoming', authMiddleware, getUpcoming);
router.get('/top-rated', authMiddleware, getTopRated);
router.get('/bollywood', authMiddleware, getBollywood);
router.get('/genre/:genreId', authMiddleware, getByGenre);
router.get('/movie/:id', authMiddleware, getMovieDetails);
router.get('/search', authMiddleware, searchMovies);
router.get('/movie/:id/trailers', authMiddleware, getMovieTrailers);

export default router;
